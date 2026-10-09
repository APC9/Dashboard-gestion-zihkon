import { parseBody, parseParams, route } from "@/lib/api/handler";
import { logReviewAction } from "@/lib/api/review-action";
import { requireActor } from "@/lib/auth/session";
import { getReview, rejectReview } from "@/lib/data/gbp";
import { intParam } from "@/lib/validation/common";
import { reviewRejectSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const input = await parseBody(req, reviewRejectSchema);
  await rejectReview(actor, id, input.reason);
  const review = await getReview(actor, id);
  await logReviewAction(actor, req, review, "gbp.review.reject", "Rechazó respuesta GBP");
  return { review };
});
