import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { triggerContentGeneration } from "@/lib/n8n/triggers";
import { uuidParam } from "@/lib/validation/common";
import { contentGenerateSchema } from "@/lib/validation/content";

type Ctx = { params: Promise<{ id: string }> };

/** Generar / enviar a IA / regenerar: todo lo ejecuta n8n. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const input = await parseBody(req, contentGenerateSchema);
  const result = await triggerContentGeneration(actor, id, input, req);
  return { n8n: { ok: result.ok, message: result.message, requestId: result.requestId } };
});
