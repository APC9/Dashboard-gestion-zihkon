import "server-only";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { assertClientAccess, clientScope } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  CONTENT_DONE_STATUSES,
  CONTENT_ERROR_STATUSES,
  CONTENT_READY_STATUSES,
  SESSION_ACTIVE_STATUSES,
} from "@/lib/status";
import type { ContentListQuery } from "@/lib/validation/content";
import { contains, paginate, paginated, statusIn } from "./helpers";

function intakeStatusFilter(status: ContentListQuery["status"]): Prisma.ContentIntakeWhereInput {
  switch (status) {
    case "pending":
      return { NOT: { OR: [...statusIn(CONTENT_DONE_STATUSES), ...statusIn(CONTENT_ERROR_STATUSES)] } };
    case "ready":
      return { OR: statusIn(CONTENT_READY_STATUSES) };
    case "error":
      return { OR: statusIn(CONTENT_ERROR_STATUSES) };
    case "done":
      return { OR: statusIn(CONTENT_DONE_STATUSES) };
    default:
      return {};
  }
}

export async function listIntakes(actor: Actor, query: ContentListQuery) {
  const and: Prisma.ContentIntakeWhereInput[] = [clientScope(actor), intakeStatusFilter(query.status)];
  if (query.clientId) {
    assertClientAccess(actor, query.clientId);
    and.push({ clientId: query.clientId });
  }
  if (query.q) and.push({ OR: [{ description: contains(query.q) }, { client: { clientName: contains(query.q) } }] });
  const where: Prisma.ContentIntakeWhereInput = { AND: and };

  const [items, total] = await Promise.all([
    prisma.contentIntake.findMany({
      where,
      include: {
        client: { select: { clientId: true, clientName: true } },
        media: { orderBy: [{ position: "asc" }], take: 4 },
        _count: { select: { media: true, sessions: true } },
      },
      orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.contentIntake.count({ where }),
  ]);
  return paginated(items, total, query.page, query.pageSize);
}

export async function getIntake(actor: Actor, intakeId: string) {
  const intake = await prisma.contentIntake.findUnique({
    where: { intakeId },
    include: {
      client: { select: { clientId: true, clientName: true, whatsappE164: true, metricoolBlogId: true } },
      media: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      sessions: {
        orderBy: { createdAt: "desc" },
        include: { media: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!intake) throw new NotFoundError("Contenido no encontrado");
  assertClientAccess(actor, intake.clientId);
  return intake;
}

export async function updateIntakeDescription(actor: Actor, intakeId: string, description: string) {
  await getIntake(actor, intakeId);
  return prisma.contentIntake.update({ where: { intakeId }, data: { description: description || null } });
}

/** Estados de content_intakes que aún se pueden cancelar (CHECK de la BD: awaiting_description, ready, processing, processed, failed). */
const CANCELLABLE_INTAKE_STATUSES = ["awaiting_description", "ready"];
/** Sesiones de WhatsApp todavía abiertas (CHECK de content_sessions). */
const OPEN_SESSION_STATUSES = ["WAITING_MEDIA", "WAITING_DESCRIPTION", "WAITING_CONFIRMATION", "PROCESSING"];

/**
 * Cancelar = lo mismo que hace n8n con CANCELAR por WhatsApp: el contenido pasa a "failed" y caduca,
 * y su sesión abierta pasa a CANCELLED. No se borra nada.
 */
export async function cancelIntake(actor: Actor, intakeId: string) {
  const intake = await getIntake(actor, intakeId);
  if (!CANCELLABLE_INTAKE_STATUSES.includes(String(intake.status ?? "").toLowerCase())) {
    throw new ConflictError("Este contenido ya está procesado o cancelado: no se puede cancelar.");
  }
  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.contentIntake.update({ where: { intakeId }, data: { status: "failed", expiresAt: now } }),
    prisma.contentSession.updateMany({
      where: { contentIntakeId: intakeId, status: { in: OPEN_SESSION_STATUSES } },
      data: { status: "CANCELLED", completedAt: now },
    }),
  ]);
  return updated;
}

export async function listActiveSessions(actor: Actor, take = 50) {
  return prisma.contentSession.findMany({
    where: { AND: [clientScope(actor), { OR: statusIn(SESSION_ACTIVE_STATUSES) }] },
    include: { client: { select: { clientId: true, clientName: true } }, _count: { select: { media: true } } },
    orderBy: [{ updatedAt: { sort: "desc", nulls: "last" } }],
    take,
  });
}

export async function listRecentSessionMedia(actor: Actor, take = 48) {
  const scope = clientScope(actor);
  return prisma.contentSessionMedia.findMany({
    where: scope.clientId ? { session: { clientId: scope.clientId } } : {},
    include: { session: { select: { sessionId: true, clientId: true, client: { select: { clientName: true } } } } },
    orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
    take,
  });
}

export async function listMessageErrors(actor: Actor, take = 100) {
  return prisma.processedMessage.findMany({
    where: { AND: [clientScope(actor), { OR: [{ error: { not: null } }, ...statusIn(CONTENT_ERROR_STATUSES)] }] },
    include: { client: { select: { clientId: true, clientName: true } } },
    orderBy: [{ receivedAt: { sort: "desc", nulls: "last" } }],
    take,
  });
}

export async function contentCounts(actor: Actor) {
  const scope = clientScope(actor);
  const [received, pending, ready, errors, activeSessions] = await Promise.all([
    prisma.contentIntake.count({ where: scope }),
    prisma.contentIntake.count({ where: { AND: [scope, intakeStatusFilter("pending")] } }),
    prisma.contentIntake.count({ where: { AND: [scope, intakeStatusFilter("ready")] } }),
    prisma.processedMessage.count({
      where: { AND: [scope, { OR: [{ error: { not: null } }, ...statusIn(CONTENT_ERROR_STATUSES)] }] },
    }),
    prisma.contentSession.count({ where: { AND: [scope, { OR: statusIn(SESSION_ACTIVE_STATUSES) }] } }),
  ]);
  return { received, pending, ready, errors, activeSessions };
}
