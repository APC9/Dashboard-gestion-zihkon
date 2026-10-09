import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getReview, updateReviewResponse } from "@/lib/data/gbp";
import { intParam } from "@/lib/validation/common";
import { reviewUpdateSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  return getReview(actor, id);
});

/** Editar la respuesta generada (borrador). No publica nada. */
export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const input = await parseBody(req, reviewUpdateSchema);
  const review = await getReview(actor, id);
  const updated =
    input.generatedResponse !== undefined ? await updateReviewResponse(actor, id, input.generatedResponse) : review;
  await logActivity(actor, {
    action: "gbp.review.edit",
    clientId: review.clientId != null ? String(review.clientId) : null,
    clientLabel: review.gbpClient?.businessName,
    resourceType: "gbp_review",
    resourceId: String(id),
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Editó la respuesta de una reseña",
  });
  return updated;
});
