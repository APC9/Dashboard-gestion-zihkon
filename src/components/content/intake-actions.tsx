"use client";

import { Ban, Bot, Eye, Loader2, MoreHorizontal, Pencil, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { api, toastError, toastN8n } from "@/lib/api-client";

type Mode = "generate" | "send_to_ai" | "regenerate";
const MODE_LABEL: Record<Mode, string> = {
  generate: "Generación de contenido solicitada",
  send_to_ai: "Contenido enviado a la IA",
  regenerate: "Regeneración solicitada",
};

export function useIntakeActions(intakeId: string) {
  const router = useRouter();
  const generate = async (mode: Mode, instructions?: string) => {
    try {
      const res = await api<{ n8n: { ok: boolean; message: string } }>(`/api/content/${intakeId}/generate`, {
        method: "POST",
        body: { mode, instructions: instructions || undefined },
      });
      toastN8n(res, MODE_LABEL[mode]);
    } catch (e) {
      toastError(e);
    }
  };
  const saveDescription = async (description: string) => {
    await api(`/api/content/${intakeId}`, { method: "PATCH", body: { description } });
    toast.success("Descripción actualizada");
    router.refresh();
  };
  const cancel = async () => {
    await api(`/api/content/${intakeId}/cancel`, { method: "POST", body: {} });
    toast.success("Contenido cancelado");
    router.refresh();
  };
  return { generate, saveDescription, cancel };
}

export function IntakeActions({
  intakeId,
  description,
  showView = true,
  variant = "menu",
}: {
  intakeId: string;
  description: string | null;
  showView?: boolean;
  variant?: "menu" | "buttons";
}) {
  const { generate, saveDescription, cancel } = useIntakeActions(intakeId);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const dialogs = (
    <>
      <EditDescriptionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={description ?? ""}
        onSave={async (d) => {
          try {
            await saveDescription(d);
            setEditOpen(false);
          } catch (e) {
            toastError(e);
          }
        }}
      />
      <InstructionsDialog
        mode={aiOpen}
        onOpenChange={(o) => !o && setAiOpen(null)}
        onSubmit={async (text) => {
          if (!aiOpen) return;
          await generate(aiOpen, text);
          setAiOpen(null);
        }}
      />
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este contenido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará como cancelado y n8n dejará de procesarlo. Los archivos de Drive no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await cancel();
                  setCancelOpen(false);
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              Cancelar contenido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (variant === "buttons") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => run(() => generate("generate"))}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generar contenido
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAiOpen("send_to_ai")}>
          <Bot className="size-4" /> Enviar a IA
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAiOpen("regenerate")}>
          <RefreshCw className="size-4" /> Regenerar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" /> Editar descripción
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" /> Cancelar
        </Button>
        {dialogs}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Acciones" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/content/${intakeId}`}>
                <Eye className="size-4" /> Ver
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Editar descripción
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => run(() => generate("generate"))}>
            <Sparkles className="size-4" /> Generar contenido
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAiOpen("send_to_ai")}>
            <Bot className="size-4" /> Enviar a IA
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAiOpen("regenerate")}>
            <RefreshCw className="size-4" /> Regenerar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setCancelOpen(true)}>
            <Ban className="size-4" /> Cancelar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}

function EditDescriptionDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: string;
  onSave: (d: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setValue(initial);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar descripción</DialogTitle>
          <DialogDescription>La IA usa esta descripción como contexto al generar el contenido.</DialogDescription>
        </DialogHeader>
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={6} maxLength={4000} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onSave(value.trim());
              setPending(false);
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstructionsDialog({
  mode,
  onOpenChange,
  onSubmit,
}: {
  mode: Mode | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "regenerate" ? "Regenerar contenido" : "Enviar a IA"}</DialogTitle>
          <DialogDescription>Instrucciones opcionales para la IA (tono, formato, plataforma…).</DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Ej.: Escribe un post para Instagram con tono cercano y 3 hashtags locales."
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onSubmit(value.trim());
              setPending(false);
              setValue("");
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Enviar a n8n
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
