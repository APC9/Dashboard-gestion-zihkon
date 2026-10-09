"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, toastError } from "@/lib/api-client";
import { gbpProfileFormSchema, type GbpProfileFormValues } from "@/lib/validation/gbp";

type Output = z.output<typeof gbpProfileFormSchema>;

export interface GbpProfileInitial {
  id?: number;
  businessName?: string | null;
  locationId?: string | null;
  accountId?: string | null;
  businessType?: string | null;
  responseTone?: string | null;
  preferredLanguage?: string | null;
  responseMode?: string | null;
  customAiInstructions?: string | null;
  notificationEmail?: string | null;
  telegramChatId?: string | null;
  whatsappE164?: string | null;
  delayMinutes?: number | null;
  contactEmail?: string | null;
  active?: boolean | null;
}

/** Sugerencias: los valores reales son TEXT libre y se respetan si son distintos. */
const SUGGESTIONS = {
  responseTone: ["profesional", "cercano", "formal", "amable", "divertido"],
  preferredLanguage: ["es", "en", "ca", "eu", "gl", "pt", "fr"],
  responseMode: ["APPROVAL", "AUTO", "MANUAL"],
};

export function GbpProfileForm({ initial, onSaved }: { initial?: GbpProfileInitial; onSaved?: (id: number) => void }) {
  const router = useRouter();
  const isEdit = initial?.id != null;
  const form = useForm<GbpProfileFormValues, unknown, Output>({
    resolver: zodResolver(gbpProfileFormSchema),
    defaultValues: {
      businessName: initial?.businessName ?? "",
      locationId: initial?.locationId ?? "",
      accountId: initial?.accountId ?? "",
      businessType: initial?.businessType ?? "",
      responseTone: initial?.responseTone ?? "",
      preferredLanguage: initial?.preferredLanguage ?? "es",
      responseMode: initial?.responseMode ?? "",
      customAiInstructions: initial?.customAiInstructions ?? "",
      notificationEmail: initial?.notificationEmail ?? "",
      telegramChatId: initial?.telegramChatId ?? "",
      whatsappE164: initial?.whatsappE164 ?? "",
      delayMinutes: initial?.delayMinutes ?? null,
      contactEmail: initial?.contactEmail ?? "",
      active: initial?.active ?? true,
    },
  });

  const onSubmit = async (values: Output) => {
    try {
      if (isEdit) {
        await api(`/api/gbp/profiles/${initial!.id}`, { method: "PATCH", body: values });
        toast.success("Configuración de Google Business guardada");
        form.reset(values);
        router.refresh();
        onSaved?.(initial!.id!);
      } else {
        const created = await api<{ id: number }>("/api/gbp/profiles", { method: "POST", body: values });
        toast.success("Perfil creado");
        if (onSaved) onSaved(created.id);
        else router.push(`/gbp/profiles/${created.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.issues) {
        for (const [k, m] of Object.entries(error.issues)) {
          if (k in form.getValues()) form.setError(k as keyof GbpProfileFormValues, { message: m[0] });
        }
      }
      toastError(error);
    }
  };

  const fid = (n: string) => `${n}-${initial?.id ?? "new"}`;

  const text = (
    name: Exclude<keyof GbpProfileFormValues, "active" | "delayMinutes" | "customAiInstructions">,
    label: string,
    opts: { placeholder?: string; description?: string; list?: string; type?: string } = {},
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={fid(name)}>{label}</FieldLabel>
          <Input id={fid(name)} {...field} value={field.value ?? ""} type={opts.type} list={opts.list} placeholder={opts.placeholder} aria-invalid={fieldState.invalid} />
          {opts.description ? <FieldDescription>{opts.description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        {text("businessName", "Nombre del negocio")}
        {text("businessType", "Tipo de negocio", { placeholder: "Restaurante, clínica…" })}
        {text("locationId", "Location ID", { placeholder: "locations/…" })}
        {text("accountId", "Account ID", { placeholder: "accounts/…" })}
        {text("responseTone", "Tono de respuesta", { list: "gbp-tones" })}
        {text("preferredLanguage", "Idioma preferido", { list: "gbp-langs" })}
        {text("responseMode", "Modo de respuesta", { list: "gbp-modes", description: "APPROVAL: requiere aprobación · AUTO: publica solo" })}
        <Controller
          control={form.control}
          name="delayMinutes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={fid("delayMinutes")}>Retraso (minutos)</FieldLabel>
              <Input
                id={fid("delayMinutes")}
                type="number"
                min={0}
                max={10080}
                inputMode="numeric"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>Espera antes de publicar una respuesta automática.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        {text("notificationEmail", "Email de notificaciones", { type: "email" })}
        {text("contactEmail", "Email de contacto", { type: "email" })}
        {text("whatsappE164", "WhatsApp", { placeholder: "+34600111222" })}
        {text("telegramChatId", "Telegram Chat ID")}
        <div className="md:col-span-2">
          <Controller
            control={form.control}
            name="customAiInstructions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={fid("customAiInstructions")}>Instrucciones personalizadas para la IA</FieldLabel>
                <Textarea
                  id={fid("customAiInstructions")}
                  rows={4}
                  {...field}
                  placeholder="Ej.: Firma siempre como 'El equipo de Café Aurora'. No ofrezcas descuentos."
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Field orientation="horizontal" className="rounded-lg border p-3 md:col-span-2">
              <FieldContent>
                <FieldLabel>Automatización de reseñas activa</FieldLabel>
                <FieldDescription>Si se desactiva, n8n deja de procesar las reseñas de este perfil.</FieldDescription>
              </FieldContent>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
        <datalist id="gbp-tones">{SUGGESTIONS.responseTone.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="gbp-langs">{SUGGESTIONS.preferredLanguage.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="gbp-modes">{SUGGESTIONS.responseMode.map((v) => <option key={v} value={v} />)}</datalist>
      </FieldGroup>
      <div className="flex justify-end gap-2">
        {isEdit ? (
          <Button type="button" variant="outline" disabled={!form.formState.isDirty} onClick={() => form.reset()}>
            Descartar cambios
          </Button>
        ) : null}
        <Button type="submit" disabled={form.formState.isSubmitting || (isEdit && !form.formState.isDirty)}>
          {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isEdit ? "Guardar" : "Crear perfil"}
        </Button>
      </div>
    </form>
  );
}
