"use client";

import { Copy, CreditCard, ExternalLink, Link2, Loader2, Undo2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api, toastError } from "@/lib/api-client";

export interface BillingPlanItem {
  planKey: string;
  name: string;
  kind: string;
  setupAmountCents: number;
  monthlyAmountCents: number;
  yearlyAmountCents: number | null;
  synced: boolean;
}

export interface ClientBillingView {
  status: string;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingName: string | null;
  taxId: string | null;
  plans: { planKey: string; name: string; status: string }[];
  checkouts: { id: string; planKeys: string[]; status: string; url: string | null; createdAt: string | null }[];
  payments: { id: string; concept: string; totalCents: number; paymentMethod: string | null; status: string; paidAt: string | null }[];
}

const VAT = 0.21;
const eur = (cents: number) => (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES") : "—");

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  none: { label: "Sin suscripción", tone: "neutral" },
  pending: { label: "Pendiente de cobro (SEPA)", tone: "warning" },
  active: { label: "Al día", tone: "success" },
  past_due: { label: "Cobro fallido", tone: "danger" },
  canceled: { label: "Finalizada", tone: "neutral" },
};
const CHECKOUT_STATUS: Record<string, string> = { open: "Enviado", processing: "Cobrando (SEPA)", paid: "Pagado", failed: "Fallido", expired: "Caducado" };

/** Pestaña "Cobros": suscripción del cliente, enlace de pago y cobros (para la gestoría). */
export function ClientBilling({ clientId, plans, billing, stripeConfigured }: { clientId: string; plans: BillingPlanItem[]; billing: ClientBillingView; stripeConfigured: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const hasSubscription = ["pending", "active", "past_due"].includes(billing.status);
  const chosen = plans.filter((p) => selected.includes(p.planKey));
  const recurring = (p: BillingPlanItem) => (interval === "year" ? (p.yearlyAmountCents ?? p.monthlyAmountCents * 12) : p.monthlyAmountCents);
  const subtotal = chosen.reduce((s, p) => s + p.setupAmountCents + recurring(p), 0);
  const nextFee = chosen.reduce((s, p) => s + recurring(p), 0);

  async function createLink() {
    setBusy(true);
    try {
      const res = await api<{ url: string }>(`/api/clients/${clientId}/billing`, { method: "POST", body: { planKeys: selected, interval } });
      setLink(res.url);
      toast.success("Enlace de pago creado");
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function setCancel(cancel: boolean) {
    try {
      await api(`/api/clients/${clientId}/billing/cancel`, { method: "POST", body: { cancel } });
      toast.success(cancel ? "Baja programada para el final del periodo pagado" : "Baja anulada");
      router.refresh();
    } catch (e) {
      toastError(e);
    }
  }

  async function portal() {
    try {
      const res = await api<{ url: string }>(`/api/clients/${clientId}/billing/portal`, { method: "POST" });
      await navigator.clipboard.writeText(res.url);
      toast.success("Enlace al portal de pagos copiado");
    } catch (e) {
      toastError(e);
    }
  }

  const status = STATUS[billing.status] ?? { label: billing.status, tone: "neutral" as const };
  const month = new Date().toISOString().slice(0, 7);

  return (
    <div className="flex flex-col gap-6">
      {!stripeConfigured ? <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Stripe no está configurado en este entorno (STRIPE_SECRET_KEY).</p> : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={status.label} tone={status.tone} />
          {billing.billingInterval && billing.status !== "none" ? <span className="text-sm text-muted-foreground">Pago {billing.billingInterval === "year" ? "anual" : "mensual"}</span> : null}
          {billing.currentPeriodEnd ? (
            <span className="text-sm text-muted-foreground">
              {billing.cancelAtPeriodEnd ? "Se da de baja el" : "Próxima renovación:"} {date(billing.currentPeriodEnd)}
            </span>
          ) : null}
        </div>
        {billing.plans.length ? (
          <ul className="text-sm">
            {billing.plans.map((p) => (
              <li key={p.planKey}>
                {p.name} <span className="text-muted-foreground">· {p.status === "active" ? "activo" : p.status === "canceled" ? "finalizado" : "pendiente"}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {billing.billingName || billing.taxId ? (
          <p className="text-xs text-muted-foreground">
            Datos fiscales: {billing.billingName ?? "—"} {billing.taxId ? `· ${billing.taxId}` : ""}
          </p>
        ) : null}
        {hasSubscription ? (
          <div className="flex flex-wrap gap-2">
            {billing.cancelAtPeriodEnd ? (
              <Button size="sm" variant="outline" onClick={() => setCancel(false)}>
                <Undo2 className="size-4" /> Anular la baja
              </Button>
            ) : (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <XCircle className="size-4" /> Dar de baja al final del periodo
                  </Button>
                }
                title="¿Dar de baja la suscripción?"
                description="No se le volverá a cobrar. Mantiene los servicios hasta el final del periodo pagado y entonces se desactivan y se le avisa por WhatsApp."
                confirmLabel="Dar de baja"
                onConfirm={() => setCancel(true)}
              />
            )}
            <Button size="sm" variant="outline" onClick={portal}>
              <CreditCard className="size-4" /> Copiar enlace al portal de pagos
            </Button>
          </div>
        ) : null}
      </section>

      {!hasSubscription ? (
        <section className="flex flex-col gap-3 border-t pt-4">
          <h3 className="text-sm font-medium">Nuevo enlace de pago</h3>
          <p className="text-xs text-muted-foreground">
            Un solo cobro con los pagos iniciales y la primera cuota; después se renueva solo. El cliente puede pagar con tarjeta o domiciliación SEPA y
            rellena su NIF/CIF y dirección fiscal. Precios sin IVA (se suma el 21 %).
          </p>
          <div className="flex gap-2">
            {(["month", "year"] as const).map((i) => (
              <Button key={i} size="sm" variant={interval === i ? "default" : "outline"} onClick={() => setInterval(i)}>
                {i === "month" ? "Mensual" : "Anual (−15 %)"}
              </Button>
            ))}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => {
              const id = `plan-${p.planKey}`;
              return (
                <li key={p.planKey} className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id={id}
                    checked={selected.includes(p.planKey)}
                    disabled={!p.synced}
                    onCheckedChange={(on) => setSelected((s) => (on ? [...s, p.planKey] : s.filter((k) => k !== p.planKey)))}
                  />
                  <label htmlFor={id} className="cursor-pointer text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {eur(p.setupAmountCents)} inicial + {interval === "year" ? `${eur(p.yearlyAmountCents ?? p.monthlyAmountCents * 12)}/año` : `${eur(p.monthlyAmountCents)}/mes`}
                      {!p.synced ? " · sin crear en Stripe" : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {chosen.length ? (
            <p className="text-sm">
              Primer cobro: {eur(subtotal)} + IVA {eur(Math.round(subtotal * VAT))} = <strong>{eur(subtotal + Math.round(subtotal * VAT))}</strong>
              <span className="text-muted-foreground">
                {" "}
                · después {eur(nextFee + Math.round(nextFee * VAT))} {interval === "year" ? "al año" : "al mes"} con IVA
              </span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={createLink} disabled={!selected.length || busy || !stripeConfigured}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Crear enlace de pago
            </Button>
            {link ? (
              <>
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Enlace copiado"))}>
                  <Copy className="size-4" /> Copiar enlace
                </Button>
                <Button asChild variant="ghost">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    Abrir <ExternalLink className="size-4" />
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {billing.checkouts.length ? (
        <section className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">Enlaces de pago</h3>
          <ul className="divide-y text-sm">
            {billing.checkouts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {c.planKeys.map((k) => plans.find((p) => p.planKey === k)?.name ?? k).join(" + ")}
                  <span className="text-muted-foreground"> · {date(c.createdAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge label={CHECKOUT_STATUS[c.status] ?? c.status} tone={c.status === "paid" ? "success" : c.status === "failed" ? "danger" : c.status === "open" || c.status === "processing" ? "warning" : "neutral"} />
                  {c.status === "open" && c.url ? (
                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(c.url!).then(() => toast.success("Enlace copiado"))}>
                      <Copy className="size-4" />
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Cobros</h3>
          <Button asChild size="sm" variant="outline">
            <a href={`/api/billing/payments?from=${month}-01&to=${month}-31&format=csv`}>Exportar cobros del mes (CSV para la gestoría)</a>
          </Button>
        </div>
        {billing.payments.length ? (
          <ul className="divide-y text-sm">
            {billing.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {p.concept}
                  <span className="text-muted-foreground">
                    {" "}
                    · {date(p.paidAt)} · {p.paymentMethod === "sepa_debit" ? "SEPA" : p.paymentMethod === "card" ? "Tarjeta" : (p.paymentMethod ?? "—")}
                  </span>
                </span>
                <strong>{eur(p.totalCents)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay cobros.</p>
        )}
      </section>
    </div>
  );
}
