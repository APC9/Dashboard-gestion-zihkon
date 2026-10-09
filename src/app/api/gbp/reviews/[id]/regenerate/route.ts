import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { triggerGbpReviewRegeneration } from "@/lib/n8n/triggers";
import { intParam } from "@/lib/validation/common";
import { reviewRegenerateSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

/** La IA vive en n8n: el panel solo solicita una nueva respuesta. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const input = await parseBody(req, reviewRegenerateSchema);
  const result = await triggerGbpReviewRegeneration(actor, id, input.instructions, req);
  return { n8n: { ok: result.ok, message: result.message, requestId: result.requestId } };
});
