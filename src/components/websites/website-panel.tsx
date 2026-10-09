"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Eye, GitBranch, Loader2, Plus, Rocket, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, toastError, toastN8n } from "@/lib/api-client";
import { formatDateTime, githubUrl } from "@/lib/format";
import { websiteFormSchema, type WebsiteFormValues } from "@/lib/validation/website";

export interface WebsiteData {
  websiteId: string;
  githubOwner: string | null;
  githubRepository: string | null;
  defaultBranch: string | null;
  netlifySiteId: string | null;
  websiteUrl: string | null;
  previewModeEnabled: boolean | null;
  active: boolean | null;
  updatedAt: Date | string | null;
}

export function WebsitePanel({ clientId, websites }: { clientId: string; websites: WebsiteData[] }) {
  // La tarjeta "Nueva web" solo se muestra si no hay ninguna web o si se pide
  // explícitamente. Tras crear se cierra: las ediciones se hacen en la tarjeta de la web creada.
  const [adding, setAdding] = useState(false);
  const showNew = adding || websites.length === 0;
  return (
    <div className="flex flex-col gap-4">
      {websites.map((w) => (
        <WebsiteCard key={w.websiteId} clientId={clientId} website={w} />
      ))}
      {showNew ? (
        <WebsiteCard
          key={`new-${websites.length}`}
          clientId={clientId}
          onCancel={websites.length ? () => setAdding(false) : undefined}
          onCreated={() => setAdding(false)}
        />
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Añadir otra web
        </Button>
      )}
    </div>
  );
}

type Output = z.output<typeof websiteFormSchema>;

function WebsiteCard({
  clientId,
  website,
  onCancel,
  onCreated,
}: {
  clientId: string;
  website?: WebsiteData;
  onCancel?: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const form = useForm<WebsiteFormValues, unknown, Output>({
    resolver: zodResolver(websiteFormSchema),
    defaultValues: {
      githubOwner: website?.githubOwner ?? "",
      githubRepository: website?.githubRepository ?? "",
      defaultBranch: website?.defaultBranch ?? "main",
      netlifySiteId: website?.netlifySiteId ?? "",
      websiteUrl: website?.websiteUrl ?? "",
      previewModeEnabled: website?.previewModeEnabled ?? false,
      active: website?.active ?? true,
    },
  });

  const onSubmit = async (values: Output) => {
    try {
      await api(`/api/clients/${clientId}/website`, {
        method: "PATCH",
        body: { ...values, ...(website ? { websiteId: website.websiteId } : {}) },
      });
      toast.success(website ? "Web actualizada" : "Web añadida");
      form.reset(values);
      if (!website) onCreated?.();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.issues) {
        for (const [k, m] of Object.entries(error.issues)) {
          if (k in form.getValues()) form.setError(k as keyof WebsiteFormValues, { message: m[0] });
        }
      }
      toastError(error);
    }
  };

  const runAction = async (action: "preview" | "publish" | "change", instructions?: string) => {
    if (!website) return;
    try {
      const res = await api<{ ok: boolean; message: string }>(`/api/clients/${clientId}/website/actions`, {
        method: "POST",
        body: { websiteId: website.websiteId, action, instructions },
      });
      toastN8n(
        { n8n: { ok: res.ok, message: res.message } },
        action === "preview" ? "Preview solicitada" : action === "publish" ? "Publicación solicitada" : "Modificación enviada a la IA",
      );
    } catch (e) {
      toastError(e);
      throw e;
    }
  };

  const gh = githubUrl(website?.githubOwner, website?.githubRepository);

  const text = (name: "githubOwner" | "githubRepository" | "defaultBranch" | "netlifySiteId" | "websiteUrl", label: string, placeholder?: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`${name}-${website?.websiteId ?? "new"}`}>{label}</FieldLabel>
          <Input id={`${name}-${website?.websiteId ?? "new"}`} {...field} placeholder={placeholder} aria-invalid={fieldState.invalid} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {website ? (website.websiteUrl?.replace(/^https?:\/\//, "") ?? "Web sin URL") : "Nueva web"}
          {website ? <ActiveBadge active={website.active} /> : null}
        </CardTitle>
        <CardDescription>
          {website ? `Última actualización: ${formatDateTime(website.updatedAt)}` : "Vincula el repositorio de GitHub y el sitio de Netlify."}
        </CardDescription>
        {website ? (
          <CardAction className="flex flex-wrap gap-2">
            {website.websiteUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={website.websiteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" /> Abrir web
                </a>
              </Button>
            ) : null}
            {gh ? (
              <Button variant="outline" size="sm" asChild>
                <a href={gh} target="_blank" rel="noopener noreferrer">
                  <GitBranch className="size-4" /> Abrir GitHub
                </a>
              </Button>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            {text("githubOwner", "GitHub Owner", "zihkon")}
            {text("githubRepository", "Repositorio", "cliente-web")}
            {text("defaultBranch", "Rama", "main")}
            {text("netlifySiteId", "Netlify Site ID")}
            <div className="md:col-span-2">{text("websiteUrl", "URL", "https://…")}</div>
            <Controller
              control={form.control}
              name="previewModeEnabled"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel>Modo preview</FieldLabel>
                    <FieldDescription>Los cambios se publican primero en preview.</FieldDescription>
                  </FieldContent>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="active"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel>Web activa</FieldLabel>
                    <FieldDescription>Desactivar no borra el repositorio.</FieldDescription>
                  </FieldContent>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />
          </FieldGroup>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {website ? (
              <div className="flex flex-wrap gap-2">
                <AiChangeDialog onSubmit={(text) => runAction("change", text)} />
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Eye className="size-4" /> Crear preview
                    </Button>
                  }
                  title="¿Crear una preview?"
                  description="n8n generará un deploy de preview en Netlify con el estado actual del repositorio."
                  confirmLabel="Crear preview"
                  onConfirm={() => runAction("preview")}
                />
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Rocket className="size-4" /> Publicar cambios
                    </Button>
                  }
                  title="¿Publicar los cambios en producción?"
                  description="n8n publicará la web en Netlify. Los visitantes verán los cambios inmediatamente."
                  confirmLabel="Publicar"
                  onConfirm={() => runAction("publish")}
                />
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {onCancel ? (
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancelar
                </Button>
              ) : null}
              <Button type="submit" disabled={form.formState.isSubmitting || (!!website && !form.formState.isDirty)}>
                {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AiChangeDialog({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const valid = text.trim().length >= 10;
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Sparkles className="size-4" /> Solicitar modificación con IA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar modificación mediante IA</DialogTitle>
          <DialogDescription>
            Describe el cambio. n8n lo aplicará en el repositorio y, si el modo preview está activo, generará una preview.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="Ej.: Cambia el horario de la sección Contacto a L-V 8:00-20:00 y añade el teléfono 910 000 000."
        />
        <p className="text-right text-xs text-muted-foreground">{text.length}/4000</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={async () => {
              setPending(true);
              try {
                await onSubmit(text.trim());
                setText("");
                setOpen(false);
              } catch {
                /* toast mostrado */
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Enviar a n8n
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
