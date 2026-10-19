import "server-only";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { ValidationError } from "@/lib/api/handler";
import { assertClientAccess, clientScope, isAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { CONTENT_DONE_STATUSES } from "@/lib/status";
import { emptyToNull } from "@/lib/validation/common";
import type { ClientCreateInput, ClientListQuery } from "@/lib/validation/client";
import { assertUniqueLocation, newProfileData } from "./gbp";
import { contains, digitsOnly, paginated, statusIn } from "./helpers";


/** Perfil de Google Business enlazado al cliente (gbp_clients.client_id). */
export interface GbpLink {
  gbpClientId: string;
  locationId: string;
  active: boolean | null;
}

const GBP_LINK_SELECT = { select: { id: true, locationId: true, active: true }, orderBy: { createdAt: "asc" } } as const;

function toGbpLinks(profiles: { id: string; locationId: string; active: boolean | null }[]): GbpLink[] {
  return profiles.map((p) => ({ gbpClientId: p.id, locationId: p.locationId, active: p.active }));
}

export interface ClientRow {
  clientId: string;
  clientName: string | null;
  whatsappE164: string | null;
  active: boolean;
  createdAt: Date | null;
  websiteUrl: string | null;
  websiteCount: number;
  gbp: GbpLink[];
  contentCount: number;
  pendingContent: number;
}

/** Listado de clientes (paginado en memoria: adecuado para cientos de clientes). */
export async function listClients(actor: Actor, query: ClientListQuery) {
  const where: Prisma.ClientWhereInput = { ...clientScope(actor) };
  const and: Prisma.ClientWhereInput[] = [];

  if (query.q) {
    const digits = digitsOnly(query.q);
    and.push({
      OR: [
        { clientName: contains(query.q) },
        ...(digits.length >= 3 ? [{ whatsappE164: { contains: digits } }] : []),
        { whatsappE164: contains(query.q) },
      ],
    });
  }
  if (query.status === "active") and.push({ active: true });
  if (query.status === "inactive") and.push({ OR: [{ active: false }, { active: null }] });
  if (query.web === "yes") and.push({ websites: { some: {} } });
  if (query.web === "no") and.push({ websites: { none: {} } });
  if (query.gbp === "yes") and.push({ gbpProfiles: { some: {} } });
  if (query.gbp === "no") and.push({ gbpProfiles: { none: {} } });
  if (and.length) where.AND = and;

  const clients = await prisma.client.findMany({
    where,
    orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
    include: {
      websites: { select: { websiteUrl: true, active: true }, orderBy: { createdAt: "asc" } },
      gbpProfiles: GBP_LINK_SELECT,
      _count: { select: { contentIntakes: true } },
    },
  });

  const pendingByClient = await pendingContentByClient(clients.map((c) => c.clientId));

  const rows: ClientRow[] = clients.map((c) => ({
    clientId: c.clientId,
    clientName: c.clientName,
    whatsappE164: c.whatsappE164,
    active: c.active === true,
    createdAt: c.createdAt,
    websiteUrl: c.websites.find((w) => w.active !== false)?.websiteUrl ?? c.websites[0]?.websiteUrl ?? null,
    websiteCount: c.websites.length,
    gbp: toGbpLinks(c.gbpProfiles),
    contentCount: c._count.contentIntakes,
    pendingContent: pendingByClient.get(c.clientId) ?? 0,
  }));

  const start = (query.page - 1) * query.pageSize;
  return paginated(rows.slice(start, start + query.pageSize), rows.length, query.page, query.pageSize);
}

async function pendingContentByClient(clientIds: string[]) {
  if (!clientIds.length) return new Map<string, number>();
  const groups = await prisma.contentIntake.groupBy({
    by: ["clientId"],
    where: { clientId: { in: clientIds }, NOT: { OR: statusIn(CONTENT_DONE_STATUSES) } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.clientId ?? "", g._count._all]));
}

export async function getClient(actor: Actor, clientId: string) {
  const client = await prisma.client.findUnique({ where: { clientId } });
  if (!client) throw new NotFoundError("Cliente no encontrado");
  assertClientAccess(actor, client.clientId);
  return client;
}

export async function getClientOverview(actor: Actor, clientId: string) {
  const client = await getClient(actor, clientId);
  const [websites, gbpProfiles, counts] = await Promise.all([
    prisma.clientWebsite.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.gbpClient.findMany({ where: { clientId }, ...GBP_LINK_SELECT }),
    prisma.client.findUnique({
      where: { clientId },
      select: { _count: { select: { contentIntakes: true, contentSessions: true, processedMessages: true } } },
    }),
  ]);
  return { client, websites, gbpLinks: toGbpLinks(gbpProfiles), counts: counts?._count };
}

/** El dueño de un código de referido (sin distinguir mayúsculas). */
async function findReferrerByCode(code: string) {
  const rows = await prisma.$queryRaw<{ client_id: string; referral_code: string }[]>`SELECT client_id, referral_code FROM public.clients WHERE upper(referral_code) = upper(${code}) LIMIT 1`;
  if (!rows[0]) throw new ValidationError({ referralCode: ["No existe ningún cliente con ese código de referido"] });
  return { clientId: rows[0].client_id, referralCode: rows[0].referral_code };
}

type ClientInput = {
  clientName?: string;
  whatsappE164?: string;
  metricoolBlogId?: string;
  email?: string;
  timezone?: string;
  active?: boolean;
};

/** Crea el cliente y, si se indica, su perfil de Google Business en la misma transacción. */
export async function createClient(actor: Actor, input: ClientCreateInput) {
  if (!isAdmin(actor)) throw new ForbiddenError();
  const { gbp, referralCode, ...clientInput } = input;
  const clientName = clientInput.clientName.trim();
  await assertUniquePhone(clientInput.whatsappE164);
  const sameName = await prisma.client.findFirst({
    where: { clientName: { equals: clientName, mode: "insensitive" } },
    select: { clientId: true },
  });
  if (sameName) throw new ConflictError(`Ya existe un cliente llamado "${clientName}"`);
  if (gbp) await assertUniqueLocation(gbp.locationId);
  const referrer = referralCode ? await findReferrerByCode(referralCode) : null;

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: { ...emptyToNull(clientInput), referredByClientId: referrer?.clientId ?? null } });
    if (referrer) await tx.clientReferral.create({ data: { referrerClientId: referrer.clientId, referredClientId: client.clientId, codeUsed: referrer.referralCode } });
    const gbpProfile = gbp
      ? await tx.gbpClient.create({ data: { ...newProfileData(client.clientId, gbp), active: clientInput.active } })
      : null;
    return { client, gbpProfile };
  });
}

export async function updateClient(actor: Actor, clientId: string, input: ClientInput) {
  await getClient(actor, clientId);
  if (input.whatsappE164) await assertUniquePhone(input.whatsappE164, clientId);
  return prisma.client.update({ where: { clientId }, data: emptyToNull(input) });
}

export async function setClientActive(actor: Actor, clientId: string, active: boolean) {
  if (!isAdmin(actor)) throw new ForbiddenError();
  await getClient(actor, clientId);
  return prisma.client.update({ where: { clientId }, data: { active } });
}

/**
 * Borrado físico solo si el cliente no tiene datos relacionados.
 * En cualquier otro caso se debe desactivar (active = false).
 */
export async function deleteClient(actor: Actor, clientId: string) {
  if (!isAdmin(actor)) throw new ForbiddenError();
  await getClient(actor, clientId);
  const related = await prisma.client.findUnique({
    where: { clientId },
    select: {
      _count: { select: { websites: true, gbpProfiles: true, contentIntakes: true, contentSessions: true, processedMessages: true } },
    },
  });
  const total = Object.values(related?._count ?? {}).reduce((a, b) => a + b, 0);
  if (total > 0) {
    throw new ConflictError(
      "El cliente tiene webs, perfiles de Google Business, contenido o mensajes asociados. Desactívalo en lugar de eliminarlo.",
    );
  }
  await prisma.client.delete({ where: { clientId } });
}

/** Evita duplicar un WhatsApp: n8n identifica al cliente por este número. */
async function assertUniquePhone(phone: string | null | undefined, exceptClientId?: string) {
  const digits = digitsOnly(phone);
  if (!digits) return;
  const candidates = await prisma.client.findMany({
    where: { whatsappE164: { contains: digits.slice(-9) }, ...(exceptClientId ? { NOT: { clientId: exceptClientId } } : {}) },
    select: { clientName: true, whatsappE164: true },
  });
  const dup = candidates.find((c) => digitsOnly(c.whatsappE164) === digits);
  if (dup) throw new ConflictError(`El WhatsApp ya pertenece a "${dup.clientName ?? "otro cliente"}"`);
}

/** Timeline de actividad de un cliente (contenido, mensajes, web). */
export async function getClientActivity(actor: Actor, clientId: string) {
  await getClient(actor, clientId);
  const [intakes, sessions, messages, websites] = await Promise.all([
    prisma.contentIntake.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { media: true } } },
    }),
    prisma.contentSession.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.processedMessage.findMany({ where: { clientId }, orderBy: { receivedAt: "desc" }, take: 30 }),
    prisma.clientWebsite.findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  type Item = { id: string; at: Date | null; kind: "content" | "session" | "message" | "website" | "error"; title: string; detail?: string | null; status?: string | null };
  const items: Item[] = [
    ...intakes.map((i) => ({
      id: `intake-${i.intakeId}`,
      at: i.createdAt,
      kind: "content" as const,
      title: `Envió ${i._count.media || i.expectedCount || 0} archivo(s) por WhatsApp`,
      detail: i.description,
      status: i.status,
    })),
    ...sessions.map((s) => ({
      id: `session-${s.sessionId}`,
      at: s.completedAt ?? s.createdAt,
      kind: "session" as const,
      title: s.completedAt ? "Sesión de contenido completada" : "Sesión de contenido iniciada",
      detail: s.description,
      status: s.status,
    })),
    ...messages.map((m) => ({
      id: `msg-${m.providerMessageId}`,
      at: m.receivedAt,
      kind: m.error ? ("error" as const) : ("message" as const),
      title: m.error ? "Error procesando mensaje" : "Mensaje procesado por la automatización",
      detail: m.error,
      status: m.status,
    })),
    ...websites.map((w) => ({
      id: `web-${w.websiteId}`,
      at: w.updatedAt ?? w.createdAt,
      kind: "website" as const,
      title: `Web actualizada: ${w.websiteUrl ?? w.githubRepository ?? "sin URL"}`,
      detail: null,
      status: w.active ? "ACTIVE" : "INACTIVE",
    })),
  ];
  return items.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, 50);
}
