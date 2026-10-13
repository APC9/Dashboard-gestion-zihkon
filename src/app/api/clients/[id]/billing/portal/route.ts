import { parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { createPortalLink } from "@/lib/data/billing";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/** Enlace al portal de Stripe del cliente (cambiar tarjeta o cuenta, ver recibos). */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return createPortalLink(actor, id, `${origin}/pago/gracias`);
});
