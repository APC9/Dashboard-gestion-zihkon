import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { REFERRAL_ACTIONS, updateReferral } from "@/lib/data/referrals";

type Ctx = { params: Promise<{ id: string; referralId: string }> };

const paramsSchema = z.object({ id: z.string().uuid("ID no válido"), referralId: z.coerce.bigint({ error: "ID no válido" }).positive() });
const bodySchema = z.object({ action: z.enum(REFERRAL_ACTIONS) }).strict();
const MESSAGES = { second_payment: "Marcó el 2.º mes pagado de un referido (mes gratis ganado)", applied: "Aplicó el mes gratis de un referido", cancel: "Canceló un referido" } as const;

/** Avanza un referido: 2.º mes pagado → mes gratis ganado → aplicado (o cancelado). */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id, referralId } = parseParams(await ctx.params, paramsSchema);
  const { action } = await parseBody(req, bodySchema);
  const r = await updateReferral(actor, id, referralId, action);
  await logActivity(actor, {
    action: `client.referral.${action}`,
    clientId: id,
    clientLabel: null,
    resourceType: "client_referral",
    resourceId: String(referralId),
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: `${MESSAGES[action]}: ${r.referred.clientName ?? r.referredClientId}`,
  });
  return { referralId: String(r.referralId), status: r.status };
});
