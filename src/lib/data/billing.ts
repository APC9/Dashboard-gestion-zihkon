import "server-only";
import type Stripe from "stripe";
import { AppError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity-log";
import { assertAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { triggerClientAutomationsNotify } from "@/lib/n8n/triggers";
import { stripe } from "@/lib/stripe";
import { getClient } from "./clients";

/** IVA que se suma a los precios del catálogo (que van sin IVA). */
export const VAT_RATE = 0.21;
export type BillingInterval = "month" | "year";

/** Quien actúa cuando el cambio lo provoca Stripe (webhook), no una persona del panel. */
const STRIPE_ACTOR: Actor = { id: "system:stripe", email: "stripe@zihkon.local", name: "Stripe", role: "ADMIN", clientId: null, gbpClientIds: [] };

/** Estados de la suscripción que cuentan como "ya tiene suscripción". */
const OPEN_STATUSES = ["pending", "active", "past_due"];

const vat = (cents: number) => Math.round(cents * VAT_RATE);

export async function listBillingPlans() {
  return prisma.billingPlan.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

/** Lo que muestra la pestaña "Cobros" de un cliente. */
export async function getClientBillingOverview(actor: Actor, clientId: string) {
  await getClient(actor, clientId);
  const [plans, billing, items, checkouts, payments] = await Promise.all([
    listBillingPlans(),
    prisma.clientBilling.findUnique({ where: { clientId } }),
    prisma.clientBillingItem.findMany({ where: { clientId }, include: { plan: true }, orderBy: { createdAt: "asc" } }),
    prisma.billingCheckout.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.billingPayment.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  return { plans, billing, items, checkouts, payments, stripeConfigured: Boolean(env().STRIPE_SECRET_KEY) };
}

/** Comprueba que los planes se pueden contratar juntos y devuelve sus filas. */
async function resolvePlans(planKeys: string[], interval: BillingInterval) {
  const unique = [...new Set(planKeys)];
  const plans = await prisma.billingPlan.findMany({ where: { planKey: { in: unique }, active: true } });
  const missing = unique.filter((k) => !plans.some((p) => p.planKey === k));
  if (missing.length) throw new NotFoundError(`Plan no encontrado: ${missing.join(", ")}`);

  const seen = new Map<string, string>();
  for (const plan of plans) {
    for (const key of plan.automationKeys) {
      if (seen.has(key)) throw new AppError(`«${plan.name}» y «${seen.get(key)}» incluyen la misma automatización: elige solo uno.`, 400, "BILLING_PLANS_OVERLAP");
      seen.set(key, plan.name);
    }
  }
  if (seen.has("publicaciones") && seen.has("publicaciones_gbp")) {
    throw new AppError("Las publicaciones multicanal ya incluyen Google: no se pueden contratar junto a un plan de publicaciones solo en Google.", 400, "BILLING_PLANS_OVERLAP");
  }
  for (const plan of plans) {
    const recurring = interval === "year" ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId;
    if (!recurring || (plan.setupAmountCents > 0 && !plan.stripeSetupPriceId)) {
      throw new AppError(`«${plan.name}» aún no está creado en Stripe. Ejecuta la sincronización del catálogo.`, 409, "BILLING_PLAN_NOT_SYNCED");
    }
  }
  return plans.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Importe sin IVA del primer cobro (pagos iniciales + primera cuota). */
function firstChargeCents(plans: Awaited<ReturnType<typeof resolvePlans>>, interval: BillingInterval) {
  return plans.reduce((sum, p) => sum + p.setupAmountCents + (interval === "year" ? (p.yearlyAmountCents ?? p.monthlyAmountCents * 12) : p.monthlyAmountCents), 0);
}

/**
 * Crea el enlace de pago (Stripe Checkout en modo suscripción): pagos iniciales + primera cuota
 * en el mismo cobro, con tarjeta o domiciliación SEPA, pidiendo NIF/CIF y dirección fiscal.
 */
export async function createClientCheckout(actor: Actor, clientId: string, planKeys: string[], interval: BillingInterval, appUrl: string) {
  assertAdmin(actor);
  const client = await getClient(actor, clientId);
  const billing = await prisma.clientBilling.findUnique({ where: { clientId } });
  if (billing && OPEN_STATUSES.includes(billing.status)) {
    throw new ConflictError("El cliente ya tiene una suscripción. Para añadir o cambiar servicios, modifica la suscripción actual.");
  }
  const plans = await resolvePlans(planKeys, interval);
  const s = stripe();

  let customerId = billing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await s.customers.create({
      name: client.clientName ?? undefined,
      phone: client.whatsappE164 ?? undefined,
      metadata: { client_id: clientId },
    });
    customerId = customer.id;
    await prisma.clientBilling.upsert({
      where: { clientId },
      create: { clientId, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const taxRates = env().STRIPE_TAX_RATE_ID ? [env().STRIPE_TAX_RATE_ID!] : undefined;
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const plan of plans) {
    lineItems.push({ price: (interval === "year" ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId)!, quantity: 1, tax_rates: taxRates });
    if (plan.setupAmountCents > 0) lineItems.push({ price: plan.stripeSetupPriceId!, quantity: 1, tax_rates: taxRates });
  }
  const metadata = { client_id: clientId, plan_keys: plans.map((p) => p.planKey).join(","), billing_interval: interval };
  const base = appUrl.replace(/\/$/, "");

  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    // Solo tarjeta y domiciliación SEPA (también deben estar activas en el panel de Stripe).
    allowed_payment_method_types: ["card", "sepa_debit"],
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { name: "auto", address: "auto" },
    locale: "es",
    metadata,
    subscription_data: { metadata },
    success_url: `${base}/pago/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pago/cancelado`,
  });

  await prisma.billingCheckout.create({
    data: {
      checkoutSessionId: session.id,
      clientId,
      planKeys: plans.map((p) => p.planKey),
      billingInterval: interval,
      url: session.url,
      createdBy: actor.email,
    },
  });
  await logActivity(actor, {
    action: "client.billing.checkout",
    clientId,
    clientLabel: client.clientName,
    resourceType: "billing_checkout",
    resourceId: session.id,
    result: "SUCCESS",
    message: `Enlace de pago: ${plans.map((p) => p.name).join(" + ")} (${interval === "year" ? "anual" : "mensual"})`,
  });
  const subtotal = firstChargeCents(plans, interval);
  return { url: session.url, checkoutSessionId: session.id, firstCharge: { subtotal, tax: vat(subtotal), total: subtotal + vat(subtotal) } };
}

// -----------------------------------------------------------------------------
// Automatizaciones: se activan al cobrar y se desactivan al terminar la suscripción.
// -----------------------------------------------------------------------------

/** Activa o desactiva automatizaciones del cliente y le avisa por WhatsApp (si n8n está configurado). */
async function setClientAutomations(clientId: string, keys: string[], enabled: boolean) {
  const current = await prisma.clientAutomation.findMany({ where: { clientId } });
  const isOn = (k: string) => current.some((c) => c.automationKey === k && c.enabled);
  const desired = new Map<string, boolean>(keys.map((k) => [k, enabled]));
  // Multicanal y "solo Google" son excluyentes: al activar una se apaga la otra.
  if (enabled && keys.includes("publicaciones")) desired.set("publicaciones_gbp", false);
  if (enabled && keys.includes("publicaciones_gbp") && !keys.includes("publicaciones")) desired.set("publicaciones", false);
  const changed = [...desired].filter(([k, on]) => isOn(k) !== on);
  if (!changed.length) return { activated: [], deactivated: [] };

  await prisma.$transaction(
    changed.map(([automationKey, on]) =>
      prisma.clientAutomation.upsert({
        where: { clientId_automationKey: { clientId, automationKey } },
        create: { clientId, automationKey, enabled: on },
        update: { enabled: on },
      }),
    ),
  );
  const activated = changed.filter(([, on]) => on).map(([k]) => k);
  const deactivated = changed.filter(([, on]) => !on).map(([k]) => k);
  if (env().N8N_WEBHOOK_BASE_URL && env().N8N_WEBHOOK_SECRET) {
    await triggerClientAutomationsNotify(STRIPE_ACTOR, clientId, { activated, deactivated }).catch((error) =>
      console.error("[billing] No se pudo avisar al cliente por WhatsApp", error),
    );
  }
  return { activated, deactivated };
}

async function automationKeysForPlans(planKeys: string[]) {
  const plans = await prisma.billingPlan.findMany({ where: { planKey: { in: planKeys } } });
  return [...new Set(plans.flatMap((p) => p.automationKeys))];
}

// -----------------------------------------------------------------------------
// Webhooks de Stripe
// -----------------------------------------------------------------------------

const toDate = (unix?: number | null) => (unix ? new Date(unix * 1000) : null);
const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

function billingDetailsFrom(session: Stripe.Checkout.Session) {
  const d = session.customer_details;
  if (!d) return {};
  return {
    billingName: d.name ?? undefined,
    billingEmail: d.email ?? undefined,
    taxId: d.tax_ids?.map((t) => t.value).join(", ") || undefined,
    billingAddress: d.address ? (JSON.parse(JSON.stringify(d.address)) as object) : undefined,
  };
}

/** Pago confirmado del alta: activa planes y automatizaciones y lo apunta para la gestoría. */
async function markCheckoutPaid(session: Stripe.Checkout.Session, asyncPayment: boolean) {
  const checkout = await prisma.billingCheckout.findUnique({ where: { checkoutSessionId: session.id } });
  if (!checkout) throw new NotFoundError(`Checkout desconocido: ${session.id}`);
  if (checkout.status === "paid") return;
  const { clientId, planKeys } = checkout;
  const interval = checkout.billingInterval as BillingInterval;
  const subscriptionId = idOf(session.subscription);
  const details = billingDetailsFrom(session);

  await prisma.$transaction([
    prisma.billingCheckout.update({ where: { checkoutSessionId: session.id }, data: { status: "paid", completedAt: new Date(), stripeSubscriptionId: subscriptionId } }),
    prisma.clientBilling.upsert({
      where: { clientId },
      create: { clientId, stripeCustomerId: idOf(session.customer), stripeSubscriptionId: subscriptionId, status: "active", billingInterval: interval, cancelAtPeriodEnd: false, ...details },
      update: { stripeSubscriptionId: subscriptionId ?? undefined, status: "active", billingInterval: interval, cancelAtPeriodEnd: false, ...details },
    }),
    ...planKeys.map((planKey) =>
      prisma.clientBillingItem.upsert({
        where: { clientId_planKey: { clientId, planKey } },
        create: { clientId, planKey, status: "active" },
        update: { status: "active" },
      }),
    ),
  ]);

  // Importes: los de Stripe si vienen; si no (emulador), se calculan del catálogo.
  const plans = await prisma.billingPlan.findMany({ where: { planKey: { in: planKeys } } });
  const fallback = plans.reduce((sum, p) => sum + p.setupAmountCents + (interval === "year" ? (p.yearlyAmountCents ?? p.monthlyAmountCents * 12) : p.monthlyAmountCents), 0);
  const subtotal = session.amount_subtotal ?? fallback;
  const tax = session.total_details?.amount_tax ?? vat(subtotal);
  await prisma.billingPayment.upsert({
    where: { stripeObjectId: session.id },
    create: {
      stripeObjectId: session.id,
      clientId,
      concept: `Alta: ${plans.map((p) => p.name).join(" + ")} (pago inicial + primera cuota ${interval === "year" ? "anual" : "mensual"})`,
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: session.amount_total ?? subtotal + tax,
      currency: session.currency ?? "eur",
      paymentMethod: asyncPayment ? "sepa_debit" : "card",
      status: "paid",
      billingName: details.billingName,
      taxId: details.taxId,
      billingAddress: details.billingAddress,
      paidAt: new Date(),
    },
    update: {},
  });

  const automations = await setClientAutomations(clientId, await automationKeysForPlans(planKeys), true);
  await logActivity(STRIPE_ACTOR, {
    action: "client.billing.paid",
    clientId,
    clientLabel: null,
    resourceType: "billing_checkout",
    resourceId: session.id,
    result: "SUCCESS",
    message: `Pago del alta recibido (${planKeys.join(", ")}). Activadas: ${automations.activated.join(", ") || "ninguna nueva"}`,
  });
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Tarjeta: pagado al momento. SEPA: "unpaid" hasta checkout.session.async_payment_succeeded.
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return markCheckoutPaid(session, false);
  const checkout = await prisma.billingCheckout.findUnique({ where: { checkoutSessionId: session.id } });
  if (!checkout) throw new NotFoundError(`Checkout desconocido: ${session.id}`);
  await prisma.$transaction([
    prisma.billingCheckout.update({ where: { checkoutSessionId: session.id }, data: { status: "processing", stripeSubscriptionId: idOf(session.subscription) } }),
    prisma.clientBilling.upsert({
      where: { clientId: checkout.clientId },
      create: { clientId: checkout.clientId, stripeCustomerId: idOf(session.customer), stripeSubscriptionId: idOf(session.subscription), status: "pending", billingInterval: checkout.billingInterval, ...billingDetailsFrom(session) },
      update: { stripeSubscriptionId: idOf(session.subscription) ?? undefined, status: "pending", billingInterval: checkout.billingInterval, ...billingDetailsFrom(session) },
    }),
  ]);
}

async function onCheckoutAsyncFailed(session: Stripe.Checkout.Session) {
  const checkout = await prisma.billingCheckout.findUnique({ where: { checkoutSessionId: session.id } });
  if (!checkout) throw new NotFoundError(`Checkout desconocido: ${session.id}`);
  await prisma.$transaction([
    prisma.billingCheckout.update({ where: { checkoutSessionId: session.id }, data: { status: "failed", completedAt: new Date() } }),
    prisma.clientBilling.updateMany({ where: { clientId: checkout.clientId, status: "pending" }, data: { status: "none", stripeSubscriptionId: null } }),
  ]);
}

/** Cuotas (y la factura del alta en modo test): el cobro real que se apunta para la gestoría. */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription) ?? idOf((invoice as unknown as { subscription?: string }).subscription);
  if (!subscriptionId) return;
  const billing = await prisma.clientBilling.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
  if (!billing) return;
  const lines = invoice.lines?.data ?? [];
  const concept = lines.map((l) => l.description).filter(Boolean).join(" + ") || "Cuota de suscripción";
  const subtotal = invoice.subtotal ?? 0;
  const total = invoice.total ?? subtotal;
  // La factura no dice con qué se pagó: se usa la forma de pago del último cobro del cliente (fase 2: leerla del pago).
  const lastPayment = await prisma.billingPayment.findFirst({ where: { clientId: billing.clientId, paymentMethod: { not: null } }, orderBy: { createdAt: "desc" } });
  const data = {
    clientId: billing.clientId,
    concept,
    subtotalCents: subtotal,
    taxCents: total - subtotal,
    totalCents: total,
    currency: invoice.currency ?? "eur",
    paymentMethod: lastPayment?.paymentMethod ?? null,
    status: "paid",
    billingName: invoice.customer_name ?? billing.billingName,
    taxId: invoice.customer_tax_ids?.map((t) => t.value).join(", ") || billing.taxId,
    billingAddress: invoice.customer_address ? (JSON.parse(JSON.stringify(invoice.customer_address)) as object) : (billing.billingAddress ?? undefined),
    paidAt: toDate(invoice.status_transitions?.paid_at) ?? new Date(),
  };
  // La primera factura ya se apuntó con el checkout: se sustituye por los importes reales de la factura.
  const checkout =
    invoice.billing_reason === "subscription_create" ? await prisma.billingCheckout.findFirst({ where: { stripeSubscriptionId: subscriptionId, status: "paid" } }) : null;
  const previous = checkout ? await prisma.billingPayment.findUnique({ where: { stripeObjectId: checkout.checkoutSessionId } }) : null;
  if (previous) {
    await prisma.billingPayment.update({ where: { paymentId: previous.paymentId }, data: { ...data, stripeObjectId: invoice.id!, concept: previous.concept } });
  } else {
    await prisma.billingPayment.upsert({ where: { stripeObjectId: invoice.id! }, create: { stripeObjectId: invoice.id!, ...data }, update: data });
  }
  await prisma.clientBilling.update({
    where: { clientId: billing.clientId },
    data: { status: billing.status === "canceled" ? undefined : "active", currentPeriodEnd: toDate(lines[0]?.period?.end) ?? undefined },
  });
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription) ?? idOf((invoice as unknown as { subscription?: string }).subscription);
  if (!subscriptionId) return;
  // Stripe reintenta el cobro; si al final no paga, cancela la suscripción (customer.subscription.deleted).
  await prisma.clientBilling.updateMany({ where: { stripeSubscriptionId: subscriptionId }, data: { status: "past_due" } });
}

function periodEnd(sub: Stripe.Subscription) {
  return toDate(sub.items?.data?.[0]?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end);
}

async function onSubscriptionUpdated(sub: Stripe.Subscription) {
  const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" || sub.status === "unpaid" ? "past_due" : sub.status === "canceled" ? "canceled" : null;
  await prisma.clientBilling.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { ...(status ? { status } : {}), cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at), currentPeriodEnd: periodEnd(sub) ?? undefined },
  });
}

/** Fin de la suscripción (cancelada al final del periodo o impagada): se desactivan sus automatizaciones. */
async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const billing = await prisma.clientBilling.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (!billing) return;
  const items = await prisma.clientBillingItem.findMany({ where: { clientId: billing.clientId, status: "active" } });
  await prisma.$transaction([
    prisma.clientBilling.update({ where: { clientId: billing.clientId }, data: { status: "canceled", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd(sub) ?? undefined } }),
    prisma.clientBillingItem.updateMany({ where: { clientId: billing.clientId, status: "active" }, data: { status: "canceled" } }),
  ]);
  const automations = await setClientAutomations(billing.clientId, await automationKeysForPlans(items.map((i) => i.planKey)), false);
  await logActivity(STRIPE_ACTOR, {
    action: "client.billing.ended",
    clientId: billing.clientId,
    clientLabel: billing.billingName,
    resourceType: "billing_subscription",
    resourceId: sub.id,
    result: "SUCCESS",
    message: `Suscripción finalizada. Desactivadas: ${automations.deactivated.join(", ") || "ninguna"}`,
  });
}

/**
 * Procesa un evento de Stripe una sola vez (Stripe puede reenviarlo). Devuelve si se ha procesado.
 * Si falla, se guarda el error y se lanza para que Stripe lo reintente.
 */
export async function handleStripeEvent(event: Stripe.Event, fallbackId: string) {
  const eventId = event.id || fallbackId;
  const existing = await prisma.stripeEvent.findUnique({ where: { eventId } });
  if (existing?.processedAt) return { processed: false, duplicate: true };
  if (!existing) await prisma.stripeEvent.create({ data: { eventId, type: event.type } });

  try {
    const object = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(object as Stripe.Checkout.Session);
        break;
      case "checkout.session.async_payment_succeeded":
        await markCheckoutPaid(object as Stripe.Checkout.Session, true);
        break;
      case "checkout.session.async_payment_failed":
        await onCheckoutAsyncFailed(object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await prisma.billingCheckout.updateMany({ where: { checkoutSessionId: (object as Stripe.Checkout.Session).id, status: "open" }, data: { status: "expired" } });
        break;
      case "invoice.paid":
        await onInvoicePaid(object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await onInvoicePaymentFailed(object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await onSubscriptionUpdated(object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(object as Stripe.Subscription);
        break;
      default:
        break; // eventos que no usamos
    }
    await prisma.stripeEvent.update({ where: { eventId }, data: { processedAt: new Date(), error: null } });
    return { processed: true, duplicate: false };
  } catch (error) {
    await prisma.stripeEvent.update({ where: { eventId }, data: { error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Acciones del panel sobre la suscripción
// -----------------------------------------------------------------------------

/** Baja al final del periodo pagado (o la anula si resume = true). */
export async function setCancelAtPeriodEnd(actor: Actor, clientId: string, cancel: boolean) {
  assertAdmin(actor);
  const client = await getClient(actor, clientId);
  const billing = await prisma.clientBilling.findUnique({ where: { clientId } });
  if (!billing?.stripeSubscriptionId || !OPEN_STATUSES.includes(billing.status)) throw new ConflictError("El cliente no tiene una suscripción activa");
  const sub = await stripe().subscriptions.update(billing.stripeSubscriptionId, { cancel_at_period_end: cancel });
  await prisma.clientBilling.update({ where: { clientId }, data: { cancelAtPeriodEnd: cancel, currentPeriodEnd: periodEnd(sub) ?? undefined } });
  await logActivity(actor, {
    action: cancel ? "client.billing.cancel" : "client.billing.resume",
    clientId,
    clientLabel: client.clientName,
    resourceType: "billing_subscription",
    resourceId: billing.stripeSubscriptionId,
    result: "SUCCESS",
    message: cancel ? "Baja al final del periodo pagado" : "Baja anulada",
  });
  return prisma.clientBilling.findUnique({ where: { clientId } });
}

/** Enlace al portal de Stripe para que el cliente cambie su forma de pago o descargue recibos. */
export async function createPortalLink(actor: Actor, clientId: string, returnUrl: string) {
  assertAdmin(actor);
  await getClient(actor, clientId);
  const billing = await prisma.clientBilling.findUnique({ where: { clientId } });
  if (!billing?.stripeCustomerId) throw new ConflictError("El cliente aún no tiene cliente en Stripe");
  const session = await stripe().billingPortal.sessions.create({ customer: billing.stripeCustomerId, return_url: returnUrl, locale: "es" });
  return { url: session.url };
}

// -----------------------------------------------------------------------------
// Exportación para la gestoría
// -----------------------------------------------------------------------------

export async function listPayments(actor: Actor, from: Date, to: Date) {
  assertAdmin(actor);
  return prisma.billingPayment.findMany({
    where: { paidAt: { gte: from, lt: to } },
    include: { client: { select: { clientName: true } } },
    orderBy: { paidAt: "asc" },
  });
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function formatAddress(address: unknown) {
  if (!address || typeof address !== "object") return "";
  const a = address as Record<string, string | null>;
  return [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean).join(", ");
}

/** CSV (separador ";" y coma decimal, como lo abre Excel en España). */
export function paymentsToCsv(rows: Awaited<ReturnType<typeof listPayments>>) {
  const header = ["Fecha de cobro", "Cliente", "Nombre fiscal", "NIF/CIF", "Dirección fiscal", "Concepto", "Base imponible (€)", "IVA (€)", "Total (€)", "Forma de pago", "Estado", "Referencia Stripe"];
  const lines = rows.map((p) =>
    [
      p.paidAt?.toISOString().slice(0, 10),
      p.client?.clientName,
      p.billingName,
      p.taxId,
      formatAddress(p.billingAddress),
      p.concept,
      euros(p.subtotalCents),
      euros(p.taxCents),
      euros(p.totalCents),
      p.paymentMethod === "sepa_debit" ? "Domiciliación SEPA" : p.paymentMethod === "card" ? "Tarjeta" : p.paymentMethod,
      p.status === "paid" ? "Cobrado" : p.status,
      p.stripeObjectId,
    ]
      .map(csvCell)
      .join(";"),
  );
  return "﻿" + [header.join(";"), ...lines].join("\r\n");
}
