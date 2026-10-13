import "server-only";
import Stripe from "stripe";
import { AppError } from "@/lib/api/errors";
import { env } from "@/lib/env";

let cached: Stripe | null = null;

/**
 * Cliente de Stripe del servidor. Con STRIPE_API_BASE (solo desarrollo) apunta al
 * emulador local en lugar de a api.stripe.com.
 */
export function stripe(): Stripe {
  if (cached) return cached;
  const { STRIPE_SECRET_KEY, STRIPE_API_BASE } = env();
  if (!STRIPE_SECRET_KEY) throw new AppError("Stripe no está configurado (STRIPE_SECRET_KEY)", 503, "STRIPE_NOT_CONFIGURED");
  if (STRIPE_SECRET_KEY.startsWith("sk_live_") && process.env.NODE_ENV !== "production") {
    throw new AppError("No se usan claves live de Stripe fuera de producción", 503, "STRIPE_LIVE_KEY_IN_DEV");
  }
  const base = STRIPE_API_BASE ? new URL(STRIPE_API_BASE) : null;
  cached = new Stripe(STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    ...(base
      ? {
          host: base.hostname,
          port: Number(base.port || (base.protocol === "https:" ? 443 : 80)),
          protocol: base.protocol.replace(":", "") as "http" | "https",
        }
      : {}),
  });
  return cached;
}

/** Comprueba la firma del webhook y devuelve el evento. */
export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const { STRIPE_WEBHOOK_SECRET } = env();
  if (!STRIPE_WEBHOOK_SECRET) throw new AppError("Falta STRIPE_WEBHOOK_SECRET", 503, "STRIPE_NOT_CONFIGURED");
  if (!signature) throw new AppError("Falta la firma de Stripe", 400, "STRIPE_SIGNATURE");
  try {
    return stripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError("Firma de Stripe no válida", 400, "STRIPE_SIGNATURE");
  }
}
