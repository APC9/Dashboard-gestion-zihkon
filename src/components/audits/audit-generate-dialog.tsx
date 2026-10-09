"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, toastError, toastN8n } from "@/lib/api-client";
import { auditGenerateSchema, type AuditGenerateValues } from "@/lib/validation/content";

export function AuditGenerateDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<AuditGenerateValues>({
    resolver: zodResolver(auditGenerateSchema),
    defaultValues: { nombre_negocio: "", direccion: "", email: "" },
  });

  const onSubmit = async (values: AuditGenerateValues) => {
    try {
      const res = await api<{ n8n: { ok: boolean; message: string } }>("/api/audits/generate", { method: "POST", body: values });
      toastN8n(res, "Auditoría solicitada. Aparecerá en el listado cuando n8n termine.");
      form.reset();
      setOpen(false);
    } catch (e) {
      toastError(e);
    }
  };

  const field = (name: keyof AuditGenerateValues, label: string, type = "text") => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`audit-${name}`}>{label}</FieldLabel>
          <Input id={`audit-${name}`} type={type} {...field} aria-invalid={fieldState.invalid} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !form.formState.isSubmitting && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nueva auditoría
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Generar auditoría local</DialogTitle>
            <DialogDescription>n8n consultará Google Places, generará el informe y el PDF y lo guardará en auditorias_locales.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {field("nombre_negocio", "Nombre del negocio")}
            {field("direccion", "Dirección")}
            {field("email", "Email de contacto", "email")}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null} Generar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
