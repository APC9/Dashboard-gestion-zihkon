"use client";

import { BadgeCheck, Copy, Gift, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, toastError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

type Status = "PENDING" | "EARNED" | "APPLIED" | "CANCELLED";

export interface ReferralsView {
  referralCode: string;
  referredBy: { clientId: string; clientName: string | null; status: Status } | null;
  referrals: { referralId: string; referredClientId: string; referredName: string | null; status: Status; createdAt: string | Date; secondPaymentAt: string | Date | null }[];
  pendingFreeMonths: number;
}

const LABEL: Record<Status, string> = {
  PENDING: "Esperando su 2.º pago",
  EARNED: "Mes gratis ganado (por aplicar)",
  APPLIED: "Mes gratis aplicado",
  CANCELLED: "Cancelado",
};
const COLOR: Record<Status, string> = {
  PENDING: "text-amber-600",
  EARNED: "text-emerald-600",
  APPLIED: "text-muted-foreground",
  CANCELLED: "text-muted-foreground line-through",
};

/** Código de referido del cliente y seguimiento de las personas que ha traído. */
export function ClientReferrals({ clientId, info, canManage }: { clientId: string; info: ReferralsView; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(referralId: string, action: "second_payment" | "applied" | "cancel", ok: string) {
    setBusy(referralId + action);
    try {
      await api(`/api/clients/${clientId}/referrals/${referralId}`, { method: "POST", body: { action } });
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-muted-foreground">Su código</p>
          <code className="font-mono text-lg font-semibold tracking-wider" data-testid="referral-code">
            {info.referralCode}
          </code>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard?.writeText(info.referralCode).then(() => toast.success("Código copiado"), () => toast.error("No se pudo copiar"))}
        >
          <Copy className="size-4" /> Copiar
        </Button>
      </div>

      {info.referredBy ? (
        <p>
          Vino recomendado por{" "}
          <Link className="font-medium hover:underline" href={`/clients/${info.referredBy.clientId}`}>
            {info.referredBy.clientName ?? "otro cliente"}
          </Link>{" "}
          · <span className={COLOR[info.referredBy.status]}>{LABEL[info.referredBy.status]}</span>
        </p>
      ) : null}

      {info.pendingFreeMonths > 0 ? (
        <p className="flex items-center gap-1.5 font-medium text-emerald-700">
          <Gift className="size-4" /> {info.pendingFreeMonths} {info.pendingFreeMonths === 1 ? "mes gratis" : "meses gratis"} por aplicar
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">Personas que ha referido</p>
        {info.referrals.length ? (
          <ul className="flex flex-col divide-y">
            {info.referrals.map((r) => (
              <li key={r.referralId} className="flex flex-col gap-1.5 py-2 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link className="font-medium hover:underline" href={`/clients/${r.referredClientId}`}>
                    {r.referredName ?? "Cliente"}
                  </Link>
                  <span className={`text-xs ${COLOR[r.status]}`}>{LABEL[r.status]}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alta: {formatDate(r.createdAt)}
                  {r.secondPaymentAt ? ` · 2.º pago: ${formatDate(r.secondPaymentAt)}` : ""}
                </p>
                {canManage && (r.status === "PENDING" || r.status === "EARNED") ? (
                  <div className="flex flex-wrap gap-2">
                    {r.status === "PENDING" ? (
                      <Button size="sm" disabled={!!busy} onClick={() => act(r.referralId, "second_payment", "2.º mes pagado: el cliente gana 1 mes gratis")}>
                        {busy === r.referralId + "second_payment" ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                        2.º mes pagado
                      </Button>
                    ) : (
                      <Button size="sm" disabled={!!busy} onClick={() => act(r.referralId, "applied", "Mes gratis aplicado")}>
                        {busy === r.referralId + "applied" ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
                        Mes gratis aplicado
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(r.referralId, "cancel", "Referido cancelado")}>
                      <XCircle className="size-4" /> Cancelar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Todavía nadie se ha dado de alta con su código.</p>
        )}
      </div>
    </div>
  );
}
