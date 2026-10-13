import { z } from "zod";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { createClientCheckout, getClientBillingOverview } from "@/lib/data/billing";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

const checkoutSchema = z
  .object({
    planKeys: z.array(z.string().trim().min(1).max(64)).min(1, "Elige al menos un plan").max(10),
    interval: z.enum(["month", "year"]).default("month"),
  })
  .strict();

/** URL pública del panel (para las páginas de vuelta del pago). */
function appUrl(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getClientBillingOverview(actor, id);
});

/** Crea el enlace de pago (Stripe Checkout) con los planes elegidos. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const { planKeys, interval } = await parseBody(req, checkoutSchema);
  return createClientCheckout(actor, id, planKeys, interval, appUrl(req));
});
