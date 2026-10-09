import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { envStatus } from "@/lib/env";
import { WORKFLOWS } from "@/lib/n8n/workflows";

export const metadata: Metadata = { title: "Configuración" };

const TABLES = [
  "clients",
  "client_websites",
  "content_intakes",
  "content_media",
  "content_sessions",
  "content_session_media",
  "processed_messages",
  "gbp_clients",
  "gbp_review_activity",
  "gbp_automation_errors",
  "auditorias_locales",
  "automation_admins",
];

export default async function SettingsPage() {
  await requireAdminPage();
  const env = envStatus();

  let dbOk = false;
  let dbVersion: string | null = null;
  let existing = new Set<string>();
  try {
    const [version, tables] = await Promise.all([
      prisma.$queryRaw<{ version: string }[]>`SELECT version()`,
      prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = ANY(${TABLES})`,
    ]);
    dbOk = true;
    dbVersion = version[0]?.version.split(" on ")[0] ?? null;
    existing = new Set(tables.map((t) => t.table_name));
  } catch {
    dbOk = false;
  }

  return (
    <>
      <PageHeader title="Configuración" description="Estado de la conexión y de las integraciones. Los secretos nunca se muestran." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variables de entorno</CardTitle>
            <CardDescription>Se definen en Coolify o en el archivo .env del servidor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Check ok={env.database} label="DATABASE_URL" />
            <Check ok={env.authSecret} label="NEXTAUTH_SECRET" />
            <Check ok={env.authUrl} label="NEXTAUTH_URL" />
            <Check ok={env.admin} label="ADMIN_EMAIL / ADMIN_PASSWORD_HASH" />
            <Check ok={env.n8nWebhooks} label="N8N_WEBHOOK_BASE_URL / N8N_WEBHOOK_SECRET" />
            <Check ok={env.n8nApi} label="N8N_API_URL / N8N_API_KEY (opcional)" optional />
            <Check ok={env.appUrl} label="NEXT_PUBLIC_APP_URL" optional />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">PostgreSQL</CardTitle>
            <CardDescription>{dbOk ? dbVersion : "No se pudo conectar a la base de datos"}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TABLES.map((t) => (
              <Check key={t} ok={existing.has(t)} label={t} mono />
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Rutas de webhooks de n8n</CardTitle>
            <CardDescription>
              URL final = N8N_WEBHOOK_BASE_URL + ruta. Cada ruta se puede cambiar con su variable de entorno.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Workflow</th>
                  <th className="py-2 pr-4 font-medium">Variable</th>
                  <th className="py-2 font-medium">Ruta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.values(WORKFLOWS).map((w) => (
                  <tr key={w.id}>
                    <td className="py-2 pr-4">{w.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{w.envPath}</td>
                    <td className="py-2 font-mono text-xs">{process.env[w.envPath] || w.defaultPath}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Check({ ok, label, optional, mono }: { ok: boolean; label: string; optional?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className={optional ? "size-4 shrink-0 text-muted-foreground" : "size-4 shrink-0 text-red-500"} />
      )}
      <span className={mono ? "font-mono text-xs" : undefined}>{label}</span>
      {!ok && optional ? <span className="text-xs text-muted-foreground">(opcional)</span> : null}
    </div>
  );
}
