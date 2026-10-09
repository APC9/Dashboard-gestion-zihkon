import { parseBody, parseParams, route } from "@/lib/api/handler";
import { logReviewAction, safeTrigger } from "@/lib/api/review-action";
import { requireActor } from "@/lib/auth/session";
import { approveReview, getReview } from "@/lib/data/gbp";
import { triggerGbpReviewApproval } from "@/lib/n8n/triggers";
import { intParam } from "@/lib/validation/common";
import { reviewApproveSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

/** Aprueba la respuesta (BD) y notifica a n8n, que decide cuándo publicarla. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const input = await parseBody(req, reviewApproveSchema);
  await approveReview(actor, id, input);
  const n8n = await safeTrigger(() =>
    triggerGbpReviewApproval(actor, id, input.scheduledPublishDate ?? null, req),
  );
  const review = await getReview(actor, id);
  await logReviewAction(actor, req, review, "gbp.review.approve", "Aprobó respuesta GBP", n8n);
  return { review, n8n };
});
