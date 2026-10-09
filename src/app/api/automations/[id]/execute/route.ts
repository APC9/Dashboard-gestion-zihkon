import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { triggerWorkflow } from "@/lib/n8n/triggers";
import { findWorkflow } from "@/lib/n8n/workflows";
import { executeWorkflowSchema } from "@/lib/validation/content";

type Ctx = { params: Promise<{ id: string }> };
const paramSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{3,64}$/, "Workflow no válido") });

/**
 * Ejecución manual de un workflow del catálogo. El recurso indicado se
 * verifica en BD y en permisos dentro de triggerWorkflow().
 */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, paramSchema);
  const workflow = findWorkflow(id);
  if (!workflow || !workflow.manual) throw new NotFoundError("Workflow no disponible para ejecución manual");
  const input = await parseBody(req, executeWorkflowSchema);
  const result = await triggerWorkflow(actor, id, input, req);
  return { n8n: { ok: result.ok, message: result.message, requestId: result.requestId, durationMs: result.durationMs } };
});
