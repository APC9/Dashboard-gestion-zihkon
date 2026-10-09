import { parseBody, parseParams, route } from "@/lib/api/handler";
import { logReviewAction, safeTrigger } from "@/lib/api/review-action";
import { requireActor } from "@/lib/auth/session";
import { getReview, scheduleReview } from "@/lib/data/gbp";
import { triggerGbpReviewApproval } from "@/lib/n8n/triggers";
import { intParam } from "@/lib/validation/common";
import { reviewScheduleSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const input = await parseBody(req, reviewScheduleSchema);
  await scheduleReview(actor, id, input.scheduledPublishDate);
  const n8n = await safeTrigger(() => triggerGbpReviewApproval(actor, id, input.scheduledPublishDate, req));
  const review = await getReview(actor, id);
  await logReviewAction(actor, req, review, "gbp.review.schedule", "Programó respuesta GBP", n8n);
  return { review, n8n };
});
