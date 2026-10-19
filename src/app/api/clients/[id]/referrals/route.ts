import { parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getClientReferrals } from "@/lib/data/referrals";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/** Código de referido del cliente, quién le refirió y a quién ha referido. */
export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getClientReferrals(actor, id);
});
