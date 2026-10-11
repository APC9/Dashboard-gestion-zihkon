"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, toastError } from "@/lib/api-client";
import { gbpProfileFormSchema, type GbpProfileFormValues } from "@/lib/validation/gbp";
import { GBP_FIELD_DEFAULTS, GbpProfileFields } from "./gbp-profile-fields";

type Output = z.output<typeof gbpProfileFormSchema>;

export interface GbpProfileInitial {
  id?: string;
  clientId?: string | null;
  locationId?: string | null;
  accountId?: string | null;
  businessType?: string | null;
  responseTone?: string | null;
  preferredLanguage?: string | null;
  responseMode?: string | null;
  customAiInstructions?: string | null;
  telegramChatId?: string | null;
  delayMinutes?: number | null;
  contactEmail?: string | null;
  active?: boolean | null;
}

export interface GbpClientOption {
  clientId: string;
  clientName: string | null;
  whatsappE164: string | null;
}

/**
 * Alta y edición de un perfil de Google Business. El nombre y el WhatsApp del
 * negocio son los del cliente enlazado, así que al crear solo se elige el cliente:
 * - `clients`: lista para elegirlo (alta desde Google Business → Perfiles).
 * - `initial.clientId` sin `clients`: cliente fijo (alta desde la ficha del cliente).
 * `refreshOnCreate`: tras crear, se queda en la página actual en vez de abrir el perfil.
 */
export function GbpProfileForm({
  initial,
  clients,
  refreshOnCreate = false,
}: {
  initial?: GbpProfileInitial;
  clients?: GbpClientOption[];
  refreshOnCreate?: boolean;
}) {
  const router = useRouter();
  const isEdit = initial?.id != null;
  const form = useForm<GbpProfileFormValues, unknown, Output>({
    resolver: zodResolver(gbpProfileFormSchema),
    defaultValues: {
      clientId: initial?.clientId ?? "",
      locationId: initial?.locationId ?? GBP_FIELD_DEFAULTS.locationId,
      accountId: initial?.accountId ?? GBP_FIELD_DEFAULTS.accountId,
      businessType: initial?.businessType ?? GBP_FIELD_DEFAULTS.businessType,
      responseTone: initial?.responseTone ?? GBP_FIELD_DEFAULTS.responseTone,
      preferredLanguage: initial?.preferredLanguage ?? GBP_FIELD_DEFAULTS.preferredLanguage,
      responseMode: initial?.responseMode === "automatic" ? "automatic" : "manual",
      customAiInstructions: initial?.customAiInstructions ?? GBP_FIELD_DEFAULTS.customAiInstructions,
      telegramChatId: initial?.telegramChatId ?? GBP_FIELD_DEFAULTS.telegramChatId,
      delayMinutes: initial?.delayMinutes ?? GBP_FIELD_DEFAULTS.delayMinutes,
      contactEmail: initial?.contactEmail ?? GBP_FIELD_DEFAULTS.contactEmail,
      active: initial?.active ?? true,
    },
  });

  const onSubmit = async (values: Output) => {
    try {
      if (isEdit) {
        // El servidor ignora clientId al editar (gbpProfileUpdateSchema lo omite).
        await api(`/api/gbp/profiles/${initial!.id}`, { method: "PATCH", body: values });
        toast.success("Configuración de Google Business guardada");
        form.reset(values);
        router.refresh();
      } else {
        const created = await api<{ id: string }>("/api/gbp/profiles", { method: "POST", body: values });
        toast.success("Perfil creado");
        if (refreshOnCreate) router.refresh();
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

  const idSuffix = initial?.id ?? "new";

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        {!isEdit && clients ? (
          <Controller
            control={form.control}
            name="clientId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="md:col-span-2">
                <FieldLabel htmlFor={`gbp-clientId-${idSuffix}`}>Cliente</FieldLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger id={`gbp-clientId-${idSuffix}`} className="w-full" aria-invalid={fieldState.invalid}>
                    <SelectValue placeholder="Selecciona el cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.clientId} value={c.clientId}>
                        {c.clientName ?? "Sin nombre"}
                        {c.whatsappE164 ? <span className="text-muted-foreground"> · {c.whatsappE164}</span> : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>El nombre y el WhatsApp del negocio se toman de este cliente.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : null}
        <GbpProfileFields control={form.control} idSuffix={idSuffix} />
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
