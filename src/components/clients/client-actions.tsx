"use client";

import { Power, PowerOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { api, toastError } from "@/lib/api-client";

export function ClientStatusButton({ clientId, clientName, active, size = "sm" }: { clientId: string; clientName: string; active: boolean; size?: "sm" | "default" }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant={active ? "outline" : "default"} size={size}>
          {active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          {active ? "Desactivar" : "Activar"}
        </Button>
      }
      title={active ? "¿Seguro que quieres desactivar este cliente?" : "¿Activar este cliente?"}
      description={
        active
          ? `"${clientName}" dejará de recibir automatizaciones. Sus datos se conservan y podrás reactivarlo cuando quieras.`
          : `"${clientName}" volverá a recibir automatizaciones.`
      }
      confirmLabel={active ? "Desactivar" : "Activar"}
      destructive={active}
      onConfirm={async () => {
        try {
          await api(`/api/clients/${clientId}`, { method: "PATCH", body: { active: !active } });
          toast.success(active ? "Cliente desactivado" : "Cliente activado");
          router.refresh();
        } catch (e) {
          toastError(e);
          throw e;
        }
      }}
    />
  );
}

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4" /> Eliminar cliente
        </Button>
      }
      title={`¿Eliminar "${clientName}"?`}
      description="Esta acción no se puede deshacer. Solo se permite si el cliente no tiene webs, contenido ni mensajes asociados; en ese caso, desactívalo."
      confirmLabel="Eliminar definitivamente"
      destructive
      onConfirm={async () => {
        try {
          await api(`/api/clients/${clientId}`, { method: "DELETE" });
          toast.success("Cliente eliminado");
          router.push("/clients");
        } catch (e) {
          toastError(e);
          throw e;
        }
      }}
    />
  );
}
