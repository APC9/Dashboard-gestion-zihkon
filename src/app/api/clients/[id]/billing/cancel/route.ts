import { z } from "zod";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { setCancelAtPeriodEnd } from "@/lib/data/billing";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/** { cancel: true } = baja al final del periodo pagado; { cancel: false } = anula la baja. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const { cancel } = await parseBody(req, z.object({ cancel: z.boolean() }).strict());
  return setCancelAtPeriodEnd(actor, id, cancel);
});
