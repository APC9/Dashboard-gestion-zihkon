import { ConflictError } from "@/lib/api/errors";
import { parseParams, route } from "@/lib/api/handler";
import { logReviewAction } from "@/lib/api/review-action";
import { requireActor } from "@/lib/auth/session";
import { getReview } from "@/lib/data/gbp";
import { triggerGbpReviewPublication } from "@/lib/n8n/triggers";
import { normalizeStatus } from "@/lib/status";
import { intParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Publicar en Google se delega 100% a n8n. El panel no marca la reseña
 * como PUBLISHED: lo hace n8n cuando Google confirma la publicación.
 */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const review = await getReview(actor, id);
  if (!["APPROVED", "SCHEDULED", "ERROR"].includes(normalizeStatus(review.status))) {
    throw new ConflictError("Solo se pueden publicar respuestas aprobadas o programadas");
  }
  if (!review.generatedResponse?.trim()) throw new ConflictError("La reseña no tiene respuesta");

  const result = await triggerGbpReviewPublication(actor, id, req);
  await logReviewAction(actor, req, review, "gbp.review.publish", "Solicitó publicar respuesta GBP", {
    ok: result.ok,
    message: result.message,
  });
  return { n8n: { ok: result.ok, message: result.message, requestId: result.requestId } };
});
