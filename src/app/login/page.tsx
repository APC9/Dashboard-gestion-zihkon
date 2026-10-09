import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const actor = await getActor();
  const { callbackUrl, error } = await searchParams;
  if (actor?.role === "ADMIN") redirect(safeCallback(callbackUrl));

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">Z</div>
          Zihkon Admin
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm callbackUrl={safeCallback(callbackUrl)} initialError={error} />
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <p className="text-3xl leading-tight font-semibold">
            Clientes, webs, reseñas y contenido.
            <br />
            Todo en un solo panel.
          </p>
          <p className="mt-3 max-w-md text-primary-foreground/80">
            Gestión humana en Zihkon Admin. Automatizaciones en n8n. Datos en PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Evita redirecciones abiertas: solo rutas internas. */
function safeCallback(url?: string) {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/login")) return "/";
  return url;
}
