"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api, toastError } from "@/lib/api-client";

export interface ClientAutomationItem {
  automationKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

/** Interruptores para habilitar las automatizaciones que ha contratado el cliente. */
export function ClientAutomationsToggles({ clientId, items }: { clientId: string; items: ClientAutomationItem[] }) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.automationKey, i.enabled])));
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(item: ClientAutomationItem, enabled: boolean) {
    setSaving(item.automationKey);
    setState((s) => ({ ...s, [item.automationKey]: enabled }));
    try {
      await api(`/api/clients/${clientId}/automations`, { method: "PATCH", body: { automationKey: item.automationKey, enabled } });
      toast.success(`${item.name}: ${enabled ? "habilitada" : "deshabilitada"}`);
      router.refresh();
    } catch (e) {
      setState((s) => ({ ...s, [item.automationKey]: !enabled }));
      toastError(e);
    } finally {
      setSaving(null);
    }
  }

  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">No hay automatizaciones en el catálogo.</p>;

  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => {
        const id = `automation-${item.automationKey}`;
        return (
          <li key={item.automationKey} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <label htmlFor={id} className="min-w-0 cursor-pointer">
              <p className="text-sm font-medium">{item.name}</p>
              {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
            </label>
            <Switch
              id={id}
              checked={state[item.automationKey] === true}
              disabled={saving === item.automationKey}
              onCheckedChange={(checked) => toggle(item, checked)}
            />
          </li>
        );
      })}
    </ul>
  );
}
