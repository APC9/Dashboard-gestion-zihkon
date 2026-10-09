"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, toastError } from "@/lib/api-client";
import { clientFormSchema, type ClientFormValues } from "@/lib/validation/client";

type Output = z.output<typeof clientFormSchema>;

export interface ClientFormInitial {
  clientId?: string;
  clientName?: string | null;
  whatsappE164?: string | null;
  driveFolderId?: string | null;
  googleSheetId?: string | null;
  googleSheetTab?: string | null;
  timezone?: string | null;
  active?: boolean | null;
}

const COMMON_TIMEZONES = ["Europe/Madrid", "Atlantic/Canary", "Europe/Lisbon", "Europe/London", "America/Mexico_City", "America/Bogota", "America/Argentina/Buenos_Aires"];

export function ClientForm({ initial }: { initial?: ClientFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.clientId);
  const form = useForm<ClientFormValues, unknown, Output>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      clientName: initial?.clientName ?? "",
      whatsappE164: initial?.whatsappE164 ?? "",
      driveFolderId: initial?.driveFolderId ?? "",
      googleSheetId: initial?.googleSheetId ?? "",
      googleSheetTab: initial?.googleSheetTab ?? "",
      timezone: initial?.timezone ?? "Europe/Madrid",
      active: initial?.active ?? true,
    },
  });

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return COMMON_TIMEZONES;
    }
  }, []);

  const onSubmit = async (values: Output) => {
    try {
      if (isEdit) {
        await api(`/api/clients/${initial!.clientId}`, { method: "PATCH", body: values });
        toast.success("Cliente actualizado");
        form.reset(values);
        router.refresh();
      } else {
        const created = await api<{ clientId: string }>("/api/clients", { method: "POST", body: values });
        toast.success("Cliente creado");
        router.push(`/clients/${created.clientId}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.issues) {
        for (const [key, messages] of Object.entries(error.issues)) {
          if (key in form.getValues()) form.setError(key as keyof ClientFormValues, { message: messages[0] });
        }
      }
      toastError(error);
    }
  };

  const text = (name: Exclude<keyof ClientFormValues, "active">, label: string, opts: { placeholder?: string; description?: string; list?: string; inputMode?: "tel" | "text" } = {}) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            {...field}
            value={field.value ?? ""}
            placeholder={opts.placeholder}
            list={opts.list}
            inputMode={opts.inputMode}
            aria-invalid={fieldState.invalid}
          />
          {opts.description ? <FieldDescription>{opts.description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup className="grid gap-5 md:grid-cols-2">
        {text("clientName", "Nombre del cliente", { placeholder: "Café Aurora" })}
        {text("whatsappE164", "WhatsApp", {
          placeholder: "+34600111222",
          inputMode: "tel",
          description: "Formato internacional E.164. n8n identifica al cliente por este número.",
        })}
        {text("driveFolderId", "Google Drive Folder ID", { description: "ID de la carpeta donde n8n guarda los archivos." })}
        {text("googleSheetId", "Google Sheet ID")}
        {text("googleSheetTab", "Google Sheet Tab", { placeholder: "Contenido" })}
        {text("timezone", "Zona horaria", { list: "timezones", placeholder: "Europe/Madrid" })}
        <datalist id="timezones">
          {timezones.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Field orientation="horizontal" className="rounded-lg border p-3 md:col-span-2">
              <FieldContent>
                <FieldLabel htmlFor="active">Cliente activo</FieldLabel>
                <FieldDescription>Los clientes inactivos no reciben automatizaciones.</FieldDescription>
              </FieldContent>
              <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
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
          {isEdit ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
