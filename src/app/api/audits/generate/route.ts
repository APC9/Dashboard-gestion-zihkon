import { parseBody, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { triggerAuditGeneration } from "@/lib/n8n/triggers";
import { auditGenerateSchema } from "@/lib/validation/content";

export const POST = route(async (req) => {
  const actor = await requireAdmin();
  const input = await parseBody(req, auditGenerateSchema);
  const result = await triggerAuditGeneration(actor, input, req);
  return { n8n: { ok: result.ok, message: result.message, requestId: result.requestId } };
});
