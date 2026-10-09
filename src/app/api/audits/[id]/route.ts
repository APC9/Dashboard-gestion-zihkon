import { z } from "zod";
import { parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { getAudit } from "@/lib/data/audits";

type Ctx = { params: Promise<{ id: string }> };
const paramSchema = z.object({ id: z.string().regex(/^\d{1,19}$/, "ID no válido") });

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, paramSchema);
  return getAudit(actor, id);
});
