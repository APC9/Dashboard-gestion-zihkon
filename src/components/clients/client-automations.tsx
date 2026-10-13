"use client";

import { BellRing, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api, toastError } from "@/lib/api-client";

export interface ClientAutomationItem {
  automationKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

/** Solo puede estar activa una de estas dos: al activar una se apaga la otra. */
const EXCLUSIVE_PAIR = ["publicaciones", "publicaciones_gbp"];

interface SaveResponse {
  activated: string[];
  deactivated: string[];
  notify: { sent: boolean; error?: string };
}

/**
 * Interruptores de las automatizaciones contratadas por el cliente.
 * Los cambios no se guardan hasta pulsar "Guardar y avisar al cliente": así el cliente
 * recibe un único WhatsApp con todo lo que se activa o finaliza.
 */
export function ClientAutomationsToggles({ clientId, items }: { clientId: string; items: ClientAutomationItem[] }) {
  const router = useRouter();
  const initial = useMemo(() => Object.fromEntries(items.map((i) => [i.automationKey, i.enabled])), [items]);
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = useState(false);

  const changes = items.filter((i) => state[i.automationKey] !== i.enabled);
  const dirty = changes.length > 0;

  async function save() {
    setSaving(true);
    try {
      const res = await api<SaveResponse>(`/api/clients/${clientId}/automations`, {
        method: "POST",
        body: { automations: Object.fromEntries(changes.map((i) => [i.automationKey, state[i.automationKey]])) },
      });
      if (res.notify.sent) toast.success("Cambios guardados y cliente avisado por WhatsApp");
      else if (res.notify.error) toast.warning(`Cambios guardados, pero no se pudo avisar al cliente: ${res.notify.error}`);
      else toast.success("Cambios guardados");
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">No hay automatizaciones en el catálogo.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y">
        {items.map((item) => {
          const id = `automation-${item.automationKey}`;
          const changed = state[item.automationKey] !== item.enabled;
          return (
            <li key={item.automationKey} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <label htmlFor={id} className="min-w-0 cursor-pointer">
                <p className="text-sm font-medium">
                  {item.name}
                  {changed ? (
                    <span className="ml-2 text-xs font-normal text-amber-600">{state[item.automationKey] ? "se activará" : "finalizará"}</span>
                  ) : null}
                </p>
                {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
              </label>
              <Switch
                id={id}
                checked={state[item.automationKey] === true}
                disabled={saving}
                onCheckedChange={(checked) =>
                  setState((s) => {
                    const next = { ...s, [item.automationKey]: checked };
                    if (checked && EXCLUSIVE_PAIR.includes(item.automationKey)) {
                      for (const other of EXCLUSIVE_PAIR) if (other !== item.automationKey && other in next) next[other] = false;
                    }
                    return next;
                  })
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
          Guardar y avisar al cliente
        </Button>
        {dirty ? (
          <Button variant="ghost" onClick={() => setState(initial)} disabled={saving}>
            <RotateCcw className="size-4" /> Deshacer
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {dirty
            ? `${changes.length} cambio${changes.length > 1 ? "s" : ""} sin guardar. El cliente recibirá un WhatsApp con lo que se activa, lo que finaliza y con qué cuenta.`
            : "Marca las automatizaciones y pulsa el botón para guardar y avisar al cliente."}
        </p>
      </div>
    </div>
  );
}
