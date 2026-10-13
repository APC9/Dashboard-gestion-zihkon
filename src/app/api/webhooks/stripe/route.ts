import { createHash } from "node:crypto";
import { route } from "@/lib/api/handler";
import { handleStripeEvent } from "@/lib/data/billing";
import { verifyStripeEvent } from "@/lib/stripe";

/**
 * Webhook de Stripe. Sin sesión (lo llama Stripe): la autenticación es la firma
 * Stripe-Signature con STRIPE_WEBHOOK_SECRET. Un error 5xx hace que Stripe lo reintente.
 */
export const POST = route(async (req) => {
  const raw = await req.text();
  const event = verifyStripeEvent(raw, req.headers.get("stripe-signature"));
  const fallbackId = "evt_sha256_" + createHash("sha256").update(raw).digest("hex").slice(0, 32);
  const result = await handleStripeEvent(event, fallbackId);
  return { received: true, ...result };
});
