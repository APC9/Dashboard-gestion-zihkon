"use client";

import { History, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { api, toastError } from "@/lib/api-client";

export interface BacklogView {
  status: "PENDING" | "IN_PROGRESS" | "LIVE";
  dailyReplyLimit: number;
  importedAt: string | null;
  finishedAt: string | null;
  queued: number;
  waitingOwner: number;
  published: number;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : null);

/** Estado de la puesta al día (reseñas antiguas sin responder) con los botones para iniciarla o detenerla. */
export function GbpBacklogPanel({ profileId, info, canEdit }: { profileId: string; info: BacklogView; canEdit: boolean }) {
  const router = useRouter();
  const pending = info.queued + info.waitingOwner;
  const label =
    info.status === "PENDING"
      ? "Puesta al día pendiente (empieza en la próxima hora, de 9 a 19 h)"
      : info.status === "IN_PROGRESS"
        ? `Poniendo al día: quedan ${pending} reseña${pending === 1 ? "" : "s"}`
        : "Al día";
  const tone = info.status === "LIVE" ? "success" : info.status === "IN_PROGRESS" ? "info" : "warning";

  async function run(action: "start" | "stop") {
    try {
      await api(`/api/gbp/profiles/${profileId}/backlog`, { method: "POST", body: { action } });
      toast.success(action === "start" ? "Puesta al día iniciada: empieza en la próxima hora (9-19 h)" : "Puesta al día detenida");
      router.refresh();
    } catch (e) {
      toastError(e);
      throw e;
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4" /> Reseñas antiguas
        </span>
        <StatusBadge label={label} tone={tone} />
      </div>
      <p className="text-xs text-muted-foreground">
        {info.importedAt ? `Iniciada el ${date(info.importedAt)}` : "Aún no se ha descargado el histórico"}
        {info.finishedAt && info.status === "LIVE" ? ` · terminada el ${date(info.finishedAt)}` : ""}
        {` · ${info.published} respondidas`}
        {info.waitingOwner ? ` · ${info.waitingOwner} esperando la decisión del dueño` : ""}
        {` · hasta ${info.dailyReplyLimit} al día`}
      </p>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {info.status === "LIVE" ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Play className="size-4" /> Iniciar puesta al día
                </Button>
              }
              title="¿Responder las reseñas antiguas sin respuesta?"
              description={`En la próxima hora en punto (de 9 a 19 h) se descargan de Google las reseñas sin respuesta y se avisa al dueño por WhatsApp. Las de 4-5★ se publican solas (hasta ${info.dailyReplyLimit} al día) y las de 1-3★ se le envían de una en una.`}
              confirmLabel="Iniciar"
              onConfirm={() => run("start")}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Square className="size-4" /> Detener puesta al día
                </Button>
              }
              title="¿Detener la puesta al día?"
              description="Las reseñas antiguas que aún no se han respondido se quedan sin responder y no se envían más al dueño. Las que ya esperan su decisión se mantienen. Las reseñas nuevas se siguen respondiendo."
              confirmLabel="Detener"
              destructive
              onConfirm={() => run("stop")}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
