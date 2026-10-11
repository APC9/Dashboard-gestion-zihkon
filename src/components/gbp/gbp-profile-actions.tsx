"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { api, toastError } from "@/lib/api-client";

/** Sin `redirectTo` se queda en la página actual y la refresca. */
export function DeleteGbpProfileButton({ id, businessName, redirectTo }: { id: string; businessName: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4" /> Eliminar perfil
        </Button>
      }
      title={`¿Eliminar el perfil "${businessName}"?`}
      description="Esta acción no se puede deshacer. Solo se permite si el perfil no tiene reseñas ni errores registrados; en ese caso, desactívalo."
      confirmLabel="Eliminar definitivamente"
      destructive
      onConfirm={async () => {
        try {
          await api(`/api/gbp/profiles/${id}`, { method: "DELETE" });
          toast.success("Perfil de Google Business eliminado");
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        } catch (e) {
          toastError(e);
          throw e;
        }
      }}
    />
  );
}
