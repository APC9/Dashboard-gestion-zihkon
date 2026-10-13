// Crea en Stripe los productos y precios de billing_plans que aún no tienen ID y los guarda en la BD.
// Uso (desarrollo):  node --env-file=.env.stripe-dev scripts/stripe-sync-catalog.mjs [--tax-rate]
//   --tax-rate  crea además el tipo de IVA (21 %, exclusivo) y muestra su ID para STRIPE_TAX_RATE_ID
//               (no funciona contra el emulador local).
// Variables: DATABASE_URL, STRIPE_SECRET_KEY y, para el emulador, STRIPE_API_BASE.
import pg from "pg";
import Stripe from "stripe";

const { DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_API_BASE } = process.env;
if (!DATABASE_URL || !STRIPE_SECRET_KEY) {
  console.error("Faltan DATABASE_URL o STRIPE_SECRET_KEY");
  process.exit(1);
}
if (STRIPE_SECRET_KEY.startsWith("sk_live_") && !process.argv.includes("--live")) {
  console.error("Clave live: este script solo se usa con claves de test o el emulador (añade --live si de verdad es producción).");
  process.exit(1);
}

const base = STRIPE_API_BASE ? new URL(STRIPE_API_BASE) : null;
const stripe = new Stripe(STRIPE_SECRET_KEY, base ? { host: base.hostname, port: Number(base.port || 80), protocol: base.protocol.replace(":", "") } : {});
const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  if (process.argv.includes("--tax-rate")) {
    const rate = await stripe.taxRates.create({ display_name: "IVA", percentage: 21, inclusive: false, country: "ES", jurisdiction: "ES", description: "IVA 21 %" });
    console.log(`Tipo de IVA creado: STRIPE_TAX_RATE_ID=${rate.id}`);
  }

  const { rows: plans } = await db.query("SELECT * FROM billing_plans WHERE active ORDER BY sort_order");
  for (const plan of plans) {
    const ids = {
      product: plan.stripe_product_id,
      setup: plan.stripe_setup_price_id,
      monthly: plan.stripe_monthly_price_id,
      yearly: plan.stripe_yearly_price_id,
    };
    const meta = { plan_key: plan.plan_key };
    if (!ids.product) {
      ids.product = (await stripe.products.create({ name: plan.name, metadata: meta })).id;
    }
    if (!ids.setup && plan.setup_amount_cents > 0) {
      ids.setup = (
        await stripe.prices.create({ product: ids.product, currency: plan.currency, unit_amount: plan.setup_amount_cents, nickname: `${plan.name} · pago inicial`, metadata: { ...meta, type: "setup" } })
      ).id;
    }
    if (!ids.monthly) {
      ids.monthly = (
        await stripe.prices.create({ product: ids.product, currency: plan.currency, unit_amount: plan.monthly_amount_cents, recurring: { interval: "month" }, nickname: `${plan.name} · mensual`, metadata: { ...meta, type: "monthly" } })
      ).id;
    }
    if (!ids.yearly && plan.yearly_amount_cents) {
      ids.yearly = (
        await stripe.prices.create({ product: ids.product, currency: plan.currency, unit_amount: plan.yearly_amount_cents, recurring: { interval: "year" }, nickname: `${plan.name} · anual`, metadata: { ...meta, type: "yearly" } })
      ).id;
    }
    await db.query(
      "UPDATE billing_plans SET stripe_product_id = $2, stripe_setup_price_id = $3, stripe_monthly_price_id = $4, stripe_yearly_price_id = $5, updated_at = now() WHERE plan_key = $1",
      [plan.plan_key, ids.product, ids.setup, ids.monthly, ids.yearly],
    );
    console.log(`${plan.plan_key}: ${ids.product} · inicial ${ids.setup ?? "—"} · mensual ${ids.monthly} · anual ${ids.yearly ?? "—"}`);
  }
} finally {
  await db.end();
}
