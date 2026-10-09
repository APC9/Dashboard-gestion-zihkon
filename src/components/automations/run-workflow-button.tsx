"use client";

import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { api, toastError, toastN8n } from "@/lib/api-client";

/** Lanza un workflow del catálogo (POST /api/automations/[id]/execute) con confirmación. */
export function RunWorkflowButton({
  workflowId,
  name,
  description,
  resourceId,
  data,
  label = "Ejecutar",
  size = "sm",
  variant = "outline",
}: {
  workflowId: string;
  name: string;
  description?: string;
  resourceId?: string | number;
  data?: Record<string, unknown>;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary";
}) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmDialog
      trigger={
        <Button size={size} variant={variant} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {label}
        </Button>
      }
      title={`¿Ejecutar "${name}"?`}
      description={description ?? "Se enviará la solicitud al webhook de n8n."}
      confirmLabel="Ejecutar"
      onConfirm={async () => {
        setPending(true);
        try {
          const res = await api<{ n8n: { ok: boolean; message: string } }>(`/api/automations/${workflowId}/execute`, {
            method: "POST",
            body: { resourceId, data },
          });
          toastN8n(res, `${name}: solicitud enviada`);
        } catch (e) {
          toastError(e);
          throw e;
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
