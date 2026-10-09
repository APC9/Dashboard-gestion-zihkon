"use client";

import { CalendarClock, Check, Loader2, RefreshCw, Save, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, toastError, toastN8n } from "@/lib/api-client";
import { normalizeStatus } from "@/lib/status";

const MAX = 4096;

export function ReviewEditor({ reviewId, status, generatedResponse }: { reviewId: number; status: string | null; generatedResponse: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(generatedResponse ?? "");
  const [saving, setSaving] = useState(false);
  const s = normalizeStatus(status);
  const dirty = text !== (generatedResponse ?? "");
  const canPublish = ["APPROVED", "SCHEDULED", "ERROR"].includes(s) && !dirty && !!generatedResponse?.trim();
  const finished = s === "PUBLISHED";

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/gbp/reviews/${reviewId}`, { method: "PATCH", body: { generatedResponse: text } });
      toast.success("Respuesta guardada");
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const action = async (path: string, body: unknown, success: string) => {
    try {
      const res = await api<{ n8n?: { ok: boolean; message: string } | null }>(`/api/gbp/reviews/${reviewId}/${path}`, {
        method: "POST",
        body,
      });
      toastN8n(res, success);
      router.refresh();
    } catch (e) {
      toastError(e);
      throw e;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={MAX}
        disabled={finished}
        placeholder="Aún no hay respuesta generada. Puedes escribirla o pedir a la IA que la genere."
        aria-label="Respuesta"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{dirty ? "Cambios sin guardar" : " "}</span>
        <span className="tabular-nums">
          {text.length}/{MAX}
        </span>
      </div>

      {finished ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">Esta respuesta ya está publicada en Google.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
          </Button>
          <ConfirmDialog
            trigger={
              <Button disabled={!text.trim()}>
                <Check className="size-4" /> Aprobar
              </Button>
            }
            title="¿Aprobar esta respuesta?"
            description="Se guardará como aprobada y n8n será notificado para publicarla según el modo de respuesta del perfil."
            confirmLabel="Aprobar"
            onConfirm={() => action("approve", { generatedResponse: text.trim() }, "Respuesta aprobada")}
          />
          <ScheduleDialog onSchedule={(iso) => action("schedule", { scheduledPublishDate: iso }, "Publicación programada")} disabled={dirty || !generatedResponse?.trim()} />
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={!canPublish}>
                <Send className="size-4" /> Publicar
              </Button>
            }
            title="¿Publicar la respuesta en Google ahora?"
            description="n8n publicará la respuesta en Google Business Profile. Será visible públicamente."
            confirmLabel="Publicar"
            onConfirm={() => action("publish", {}, "Publicación solicitada")}
          />
          <RegenerateDialog onRegenerate={(instructions) => action("regenerate", { instructions: instructions || undefined }, "Regeneración solicitada")} />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                <X className="size-4" /> Rechazar
              </Button>
            }
            title="¿Rechazar esta respuesta?"
            description="La reseña quedará marcada como rechazada y no se publicará ninguna respuesta."
            confirmLabel="Rechazar"
            destructive
            onConfirm={() => action("reject", {}, "Respuesta rechazada")}
          />
        </div>
      )}
      {!canPublish && !finished ? (
        <p className="text-xs text-muted-foreground">Para publicar, la respuesta debe estar guardada y aprobada o programada.</p>
      ) : null}
    </div>
  );
}

function ScheduleDialog({ onSchedule, disabled }: { onSchedule: (iso: string) => Promise<void>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const valid = Boolean(value);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <CalendarClock className="size-4" /> Programar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar publicación</DialogTitle>
          <DialogDescription>n8n publicará la respuesta en la fecha indicada (hora local de tu navegador).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="schedule-at">Fecha y hora</Label>
          <Input id="schedule-at" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={async () => {
              const date = new Date(value);
              if (date.getTime() <= Date.now()) {
                toast.error("La fecha debe ser futura");
                return;
              }
              setPending(true);
              try {
                await onSchedule(date.toISOString());
                setOpen(false);
              } catch {
                /* toast mostrado */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegenerateDialog({ onRegenerate }: { onRegenerate: (instructions: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="size-4" /> Regenerar respuesta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerar respuesta con IA</DialogTitle>
          <DialogDescription>n8n generará una nueva respuesta. Puedes añadir indicaciones para esta reseña.</DialogDescription>
        </DialogHeader>
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={2000} placeholder="Ej.: Más breve y menciona que hemos ampliado el horario." />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onRegenerate(value.trim());
                setValue("");
                setOpen(false);
              } catch {
                /* toast mostrado */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Regenerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
