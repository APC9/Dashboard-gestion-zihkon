"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().trim().email("Introduce un email válido"),
  password: z.string().min(1, "Introduce la contraseña"),
});
type Values = z.infer<typeof schema>;

const ERRORS: Record<string, string> = {
  CredentialsSignin: "Email o contraseña incorrectos",
  forbidden: "Tu usuario no tiene acceso al panel de administración",
  SessionRequired: "Inicia sesión para continuar",
};

export function LoginForm({ callbackUrl, initialError }: { callbackUrl: string; initialError?: string }) {
  const [error, setError] = useState<string | null>(initialError ? (ERRORS[initialError] ?? "No se pudo iniciar sesión") : null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: Values) => {
    setError(null);
    const res = await signIn("credentials", { ...values, redirect: false });
    if (!res || res.error) {
      setError(res?.error && res.error !== "CredentialsSignin" ? res.error : ERRORS.CredentialsSignin);
      return;
    }
    window.location.assign(callbackUrl);
  };

  // method="post": si el JavaScript aún no ha cargado, el navegador no pone el email y la contraseña en la URL.
  return (
    <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">Accede al panel de gestión de Zihkon</p>
      </div>
      <FieldGroup>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="username" aria-invalid={fieldState.invalid} {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={fieldState.invalid} {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
        {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        Entrar
      </Button>
    </form>
  );
}
