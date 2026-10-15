"use client";

import { BadgeCheck, Gift, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, toastError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";

export interface ClientTrialInfo {
  name: string;
  endsAt: Date | string;
  postsLimit: number;
  postsUsed: number;
  reminderSentAt: Date | string | null;
  finishedAt: Date | string | null;
  active: boolean;
  daysLeft: number;
}

const TRIAL_OPTIONS = [
  { value: "publicaciones_gbp", label: "Publicaciones en Google (GBP)" },
  { value: "publicaciones", label: "Publicaciones multicanal" },
];

interface TrialResponse {
  notify: { sent: boolean; error?: string };
}

/**
 * Prueba gratuita de 7 días de las publicaciones (máximo 4, una sola vez por cliente).
 * El recordatorio del día antes y el fin de la prueba los envía n8n.
 */
export function ClientTrialPanel({
  clientId,
  trial,
  canManage,
  hasPublications,
}: {
  clientId: string;
  trial: ClientTrialInfo | null;
  canManage: boolean;
  hasPublications: boolean;
}) {
  const router = useRouter();
  const [automationKey, setAutomationKey] = useState("publicaciones_gbp");
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, string>, ok: string) {
    setBusy(true);
    try {
      const res = await api<TrialResponse>(`/api/clients/${clientId}/automations/trial`, { method: "POST", body });
      if (body.action === "start" && !res.notify.sent) {
        toast.warning(`Prueba activada, pero no se pudo avisar al cliente${res.notify.error ? `: ${res.notify.error}` : ""}`);
      } else toast.success(ok);
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  if (trial) {
    const exhausted = trial.postsUsed >= trial.postsLimit;
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">
          {trial.name}
          <span className={`ml-2 text-xs font-normal ${trial.active ? "text-amber-600" : "text-muted-foreground"}`}>
            {trial.active ? (trial.daysLeft > 0 ? `en prueba · ${trial.daysLeft} día${trial.daysLeft === 1 ? "" : "s"} restante${trial.daysLeft === 1 ? "" : "s"}` : "vencida, se cerrará en la próxima revisión") : `terminada el ${formatDate(trial.finishedAt)}`}
          </span>
        </p>
        <p className="text-muted-foreground">
          Publicaciones usadas: <span className={exhausted ? "font-medium text-destructive" : "font-medium text-foreground"}>{trial.postsUsed}/{trial.postsLimit}</span>
          {" · "}Termina el {formatDateTime(trial.endsAt)}
          {" · "}Recordatorio: {trial.reminderSentAt ? `enviado el ${formatDateTime(trial.reminderSentAt)}` : "pendiente"}
        </p>
        {trial.active && canManage ? (
          <div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => send({ action: "convert" }, "La prueba pasa a suscripción: la automatización sigue activa")}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
              Ha contratado: pasar a suscripción
            </Button>
          </div>
        ) : null}
        {!trial.active ? <p className="text-xs text-muted-foreground">Cada cliente solo puede tener una prueba gratuita.</p> : null}
      </div>
    );
  }

  if (!canManage) return <p className="text-sm text-muted-foreground">El cliente no ha usado su prueba gratuita.</p>;
  if (hasPublications) return <p className="text-sm text-muted-foreground">El cliente ya tiene las publicaciones activas: no necesita prueba.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={automationKey} onValueChange={setAutomationKey}>
        <SelectTrigger className="w-64" aria-label="Automatización de la prueba">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRIAL_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button disabled={busy} onClick={() => send({ action: "start", automationKey }, "Prueba activada y cliente avisado por WhatsApp")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
        Activar prueba 7 días
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        7 días y máximo 4 publicaciones. El cliente recibe el aviso de activación, un recordatorio el día antes de que acabe y un mensaje al terminar. Solo una vez por cliente.
      </p>
    </div>
  );
}
