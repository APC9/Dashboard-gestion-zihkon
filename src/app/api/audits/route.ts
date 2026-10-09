import { parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { listAudits } from "@/lib/data/audits";
import { auditListQuerySchema } from "@/lib/validation/content";

export const GET = route(async (req) => {
  const actor = await requireAdmin();
  return listAudits(actor, parseParams(searchParamsObject(req), auditListQuerySchema));
});
