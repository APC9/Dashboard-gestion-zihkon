import "server-only";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { assertGbpAccess, gbpReviewScope, gbpScope, isAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeStatus, ratingToNumber, ratingVariants, REVIEW_PENDING_STATUSES } from "@/lib/status";
import { emptyToNull } from "@/lib/validation/common";
import type { GbpProfileInput, GbpProfileUpdateInput, ReviewListQuery } from "@/lib/validation/gbp";
import { contains, paginate, paginated, statusIn } from "./helpers";

// ---------------------------------------------------------------------------
// Perfiles
// ---------------------------------------------------------------------------

/** El nombre y el WhatsApp del negocio viven en clients (gbp_clients.client_id). */
export const GBP_CLIENT_SELECT = { select: { clientId: true, clientName: true, whatsappE164: true, active: true } } as const;

/** Nombre visible de un perfil: el de su cliente. */
export function gbpProfileName(profile: { client?: { clientName: string | null } | null } | null | undefined) {
  return profile?.client?.clientName ?? "Perfil sin nombre";
}

export async function listGbpProfiles(actor: Actor, opts: { q?: string; status?: "all" | "active" | "inactive" } = {}) {
  const where: Prisma.GbpClientWhereInput = { ...gbpScope(actor) };
  if (opts.q) {
    where.OR = [
      { client: { clientName: contains(opts.q) } },
      { client: { whatsappE164: contains(opts.q) } },
      { locationId: contains(opts.q) },
      { accountId: contains(opts.q) },
      { contactEmail: contains(opts.q) },
    ];
  }
  if (opts.status === "active") where.active = true;
  if (opts.status === "inactive") where.NOT = { active: true };

  const profiles = await prisma.gbpClient.findMany({
    where,
    orderBy: [{ client: { clientName: "asc" } }],
    include: { client: GBP_CLIENT_SELECT, _count: { select: { reviews: true } } },
  });
  const pending = await prisma.gbpReviewActivity.groupBy({
    by: ["clientId"],
    where: { clientId: { in: profiles.map((p) => p.id) }, OR: statusIn(REVIEW_PENDING_STATUSES) },
    _count: { _all: true },
  });
  const pendingMap = new Map(pending.map((p) => [p.clientId, p._count._all]));
  return profiles.map((p) => ({ ...p, pendingReviews: pendingMap.get(p.id) ?? 0 }));
}

export async function getGbpProfile(actor: Actor, id: string) {
  const profile = await prisma.gbpClient.findUnique({ where: { id }, include: { client: GBP_CLIENT_SELECT } });
  if (!profile) throw new NotFoundError("Perfil de Google Business no encontrado");
  assertGbpAccess(actor, profile.id);
  return profile;
}

/** Datos a escribir en gbp_clients: "" → NULL y retraso vacío → 15. */
export function profileData(input: GbpProfileUpdateInput) {
  const { delayMinutes, ...rest } = input;
  return { ...emptyToNull(rest), ...(delayMinutes !== undefined ? { delayMinutes } : {}) };
}

/** Datos de alta: igual que `profileData` pero con las columnas NOT NULL tipadas como obligatorias. */
export function newProfileData(clientId: string, input: Omit<GbpProfileInput, "clientId" | "active"> & { active?: boolean }) {
  return { ...profileData(input), clientId, locationId: input.locationId, accountId: input.accountId };
}

export async function updateGbpProfile(actor: Actor, id: string, input: GbpProfileUpdateInput) {
  await getGbpProfile(actor, id);
  if (input.locationId) await assertUniqueLocation(input.locationId, id);
  return prisma.gbpClient.update({ where: { id }, data: profileData(input), include: { client: GBP_CLIENT_SELECT } });
}

export async function createGbpProfile(actor: Actor, input: GbpProfileInput) {
  if (!isAdmin(actor)) throw new ForbiddenError();
  const client = await prisma.client.findUnique({ where: { clientId: input.clientId }, select: { clientId: true } });
  if (!client) throw new NotFoundError("Cliente no encontrado");
  await assertUniqueLocation(input.locationId);
  return prisma.gbpClient.create({ data: newProfileData(input.clientId, input), include: { client: GBP_CLIENT_SELECT } });
}

/**
 * Borrado físico solo si el perfil no tiene reseñas ni errores registrados.
 * En cualquier otro caso se debe desactivar (active = false).
 */
export async function deleteGbpProfile(actor: Actor, id: string) {
  if (!isAdmin(actor)) throw new ForbiddenError();
  const profile = await getGbpProfile(actor, id);
  const related = await prisma.gbpClient.findUnique({
    where: { id },
    select: { _count: { select: { reviews: true, errors: true } } },
  });
  if ((related?._count.reviews ?? 0) + (related?._count.errors ?? 0) > 0) {
    throw new ConflictError("El perfil tiene reseñas o errores registrados. Desactívalo en lugar de eliminarlo.");
  }
  await prisma.gbpClient.delete({ where: { id } });
  return profile;
}

/** location_id es UNIQUE en la BD: se comprueba antes para dar un error legible. */
export async function assertUniqueLocation(locationId: string, exceptId?: string) {
  const existing = await prisma.gbpClient.findFirst({
    where: { locationId: { equals: locationId.trim(), mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    include: { client: GBP_CLIENT_SELECT },
  });
  if (existing) throw new ConflictError(`Ya existe un perfil con ese Location ID: "${gbpProfileName(existing)}"`);
}

export async function reviewSummary(actor: Actor, gbpClientIds: string[]) {
  const ids = gbpClientIds.filter((id) => isAdmin(actor) || actor.gbpClientIds.includes(id));
  if (!ids.length) return null;
  const reviews = await prisma.gbpReviewActivity.findMany({
    where: { clientId: { in: ids } },
    select: { rating: true, status: true, reviewDate: true, createdDate: true },
  });
  const byStatus: Record<string, number> = {};
  let ratingSum = 0;
  let rated = 0;
  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const s = normalizeStatus(r.status) || "SIN_ESTADO";
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    const n = ratingToNumber(r.rating);
    if (n && n >= 1 && n <= 5) {
      ratingSum += n;
      rated++;
      distribution[n - 1]++;
    }
  }
  const pending = REVIEW_PENDING_STATUSES.reduce((acc, s) => acc + (byStatus[s] ?? 0), 0);
  return {
    total: reviews.length,
    pending,
    average: rated ? ratingSum / rated : null,
    byStatus,
    distribution,
  };
}

// ---------------------------------------------------------------------------
// Reseñas
// ---------------------------------------------------------------------------

export async function listReviews(actor: Actor, query: ReviewListQuery) {
  const and: Prisma.GbpReviewActivityWhereInput[] = [gbpReviewScope(actor)];
  if (query.gbpClientId) {
    assertGbpAccess(actor, query.gbpClientId);
    and.push({ clientId: query.gbpClientId });
  }
  if (query.status === "pending") and.push({ OR: statusIn(REVIEW_PENDING_STATUSES) });
  else if (query.status !== "all") and.push({ OR: statusIn([query.status]) });
  if (query.rating) and.push({ rating: { in: ratingVariants(query.rating) } });
  if (query.q) {
    and.push({
      OR: [
        { reviewerName: contains(query.q) },
        { reviewText: contains(query.q) },
        { reviewId: contains(query.q) },
        { gbpClient: { client: { clientName: contains(query.q) } } },
      ],
    });
  }
  const where: Prisma.GbpReviewActivityWhereInput = { AND: and };
  const [items, total] = await Promise.all([
    prisma.gbpReviewActivity.findMany({
      where,
      include: { gbpClient: { select: { id: true, locationId: true, client: GBP_CLIENT_SELECT } } },
      orderBy: [{ reviewDate: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.gbpReviewActivity.count({ where }),
  ]);
  return paginated(items, total, query.page, query.pageSize);
}

export async function getReview(actor: Actor, id: number) {
  const review = await prisma.gbpReviewActivity.findUnique({
    where: { id },
    include: { gbpClient: { include: { client: GBP_CLIENT_SELECT } }, errors: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!review) throw new NotFoundError("Reseña no encontrada");
  assertGbpAccess(actor, review.clientId);
  return review;
}

export async function updateReviewResponse(actor: Actor, id: number, generatedResponse: string) {
  await getReview(actor, id);
  return prisma.gbpReviewActivity.update({ where: { id }, data: { generatedResponse } });
}

export async function approveReview(
  actor: Actor,
  id: number,
  input: { generatedResponse?: string; scheduledPublishDate?: string | null },
) {
  const review = await getReview(actor, id);
  const response = input.generatedResponse ?? review.generatedResponse;
  if (!response?.trim()) throw new ConflictError("No se puede aprobar una reseña sin respuesta");
  const scheduled = input.scheduledPublishDate ? new Date(input.scheduledPublishDate) : null;
  return prisma.gbpReviewActivity.update({
    where: { id },
    data: {
      generatedResponse: response,
      status: scheduled ? "SCHEDULED" : "APPROVED",
      approvedDate: new Date(),
      scheduledPublishDate: scheduled ?? review.scheduledPublishDate,
    },
  });
}

export async function rejectReview(actor: Actor, id: number, reason?: string) {
  await getReview(actor, id);
  return prisma.gbpReviewActivity.update({
    where: { id },
    data: { status: "REJECTED", ...(reason ? { errorDetails: `Rechazada: ${reason}` } : {}) },
  });
}

export async function scheduleReview(actor: Actor, id: number, scheduledPublishDate: string) {
  const review = await getReview(actor, id);
  if (!review.generatedResponse?.trim()) throw new ConflictError("La reseña no tiene respuesta para programar");
  return prisma.gbpReviewActivity.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledPublishDate: new Date(scheduledPublishDate), approvedDate: review.approvedDate ?? new Date() },
  });
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export async function listGbpErrors(actor: Actor, opts: { q?: string; gbpClientId?: string; take?: number } = {}) {
  const where: Prisma.GbpAutomationErrorWhereInput = isAdmin(actor)
    ? {}
    : { clientId: { in: actor.gbpClientIds } };
  if (opts.gbpClientId) where.clientId = opts.gbpClientId;
  if (opts.q) where.OR = [{ errorMessage: contains(opts.q) }, { stage: contains(opts.q) }];
  return prisma.gbpAutomationError.findMany({
    where,
    include: {
      gbpClient: { select: { id: true, client: GBP_CLIENT_SELECT } },
      review: { select: { id: true, reviewId: true, reviewerName: true } },
    },
    orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
    take: opts.take ?? 200,
  });
}
