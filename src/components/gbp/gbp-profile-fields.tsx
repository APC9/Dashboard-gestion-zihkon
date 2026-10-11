"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Sugerencias: los valores reales son TEXT libre y se respetan si son distintos. */
const SUGGESTIONS = {
  responseTone: ["profesional", "cercano", "formal", "amable", "divertido"],
  preferredLanguage: ["es", "en", "ca", "eu", "gl", "pt", "fr"],
};

const RESPONSE_MODE_LABELS = {
  manual: "Manual (requiere aprobación)",
  automatic: "Automático (publica solo)",
} as const;

/** Valores iniciales de los campos compartidos de un perfil nuevo. */
export const GBP_FIELD_DEFAULTS = {
  locationId: "",
  accountId: "",
  businessType: "",
  responseTone: "",
  preferredLanguage: "es",
  responseMode: "manual" as const,
  customAiInstructions: "",
  telegramChatId: "",
  delayMinutes: 15 as number | null,
  contactEmail: "",
};

type FieldName = keyof typeof GBP_FIELD_DEFAULTS;

/**
 * Campos de configuración de un perfil de Google Business. Se usan en el
 * formulario de perfil y, con `prefix = "gbp."`, en el alta de cliente.
 */
export function GbpProfileFields<T extends FieldValues>({
  control,
  prefix = "",
  idSuffix,
}: {
  control: Control<T>;
  prefix?: string;
  idSuffix: string;
}) {
  const name = (n: FieldName) => `${prefix}${n}` as Path<T>;
  const fid = (n: FieldName) => `gbp-${n}-${idSuffix}`;

  const text = (
    n: Exclude<FieldName, "responseMode" | "delayMinutes" | "customAiInstructions">,
    label: string,
    opts: { placeholder?: string; description?: string; list?: string; type?: string } = {},
  ) => (
    <Controller
      control={control}
      name={name(n)}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={fid(n)}>{label}</FieldLabel>
          <Input id={fid(n)} {...field} value={field.value ?? ""} type={opts.type} list={opts.list} placeholder={opts.placeholder} aria-invalid={fieldState.invalid} />
          {opts.description ? <FieldDescription>{opts.description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <>
      {text("businessType", "Tipo de negocio", { placeholder: "Restaurante, clínica…" })}
      {text("locationId", "Location ID", { placeholder: "locations/…" })}
      {text("accountId", "Account ID", { placeholder: "accounts/…" })}
      {text("responseTone", "Tono de respuesta", { list: "gbp-tones" })}
      {text("preferredLanguage", "Idioma preferido", { list: "gbp-langs" })}
      <Controller
        control={control}
        name={name("responseMode")}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={fid("responseMode")}>Modo de respuesta</FieldLabel>
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id={fid("responseMode")} className="w-full" aria-invalid={fieldState.invalid}>
                <SelectValue placeholder="Selecciona un modo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESPONSE_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        control={control}
        name={name("delayMinutes")}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={fid("delayMinutes")}>Retraso (minutos)</FieldLabel>
            <Input
              id={fid("delayMinutes")}
              type="number"
              min={0}
              max={10080}
              inputMode="numeric"
              placeholder="15"
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
      {text("contactEmail", "Email de contacto", { type: "email" })}
      {text("telegramChatId", "Telegram Chat ID")}
      <div className="md:col-span-2">
        <Controller
          control={control}
          name={name("customAiInstructions")}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={fid("customAiInstructions")}>Instrucciones personalizadas para la IA</FieldLabel>
              <Textarea
                id={fid("customAiInstructions")}
                rows={4}
                {...field}
                value={field.value ?? ""}
                placeholder="Ej.: Firma siempre como 'El equipo de Café Aurora'. No ofrezcas descuentos."
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>
      <datalist id="gbp-tones">{SUGGESTIONS.responseTone.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="gbp-langs">{SUGGESTIONS.preferredLanguage.map((v) => <option key={v} value={v} />)}</datalist>
    </>
  );
}
