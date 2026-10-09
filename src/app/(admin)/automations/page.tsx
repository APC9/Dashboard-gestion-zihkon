import { Bot, CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { recentActivity } from "@/lib/activity-log";
import { requireAdminPage } from "@/lib/auth/session";
import { listMessageErrors } from "@/lib/data/content";
import { listGbpErrors } from "@/lib/data/gbp";
import { formatDateTime, formatDuration } from "@/lib/format";
import { isN8nApiConfigured, listN8nExecutions, type N8nExecution } from "@/lib/n8n/api";
import { isN8nConfigured } from "@/lib/n8n/client";
import { publicWorkflowList, type WorkflowResource } from "@/lib/n8n/workflows";

export const metadata: Metadata = { title: "Automatizaciones" };

interface Row {
  id: string;
  name: string;
  client: { label: string; href?: string } | null;
  type: string;
  at: Date | null;
  status: string;
  durationMs: number | null;
  error: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  content: "Contenido",
  website: "Web",
  gbp: "Google Business",
  audit: "Auditoría",
  system: "Sistema",
};

const WHERE: Record<WorkflowResource, { label: string; href: string }> = {
  client: { label: "Ficha del cliente → Automatizaciones", href: "/clients" },
  website: { label: "Ficha del cliente → Web", href: "/websites" },
  content: { label: "Contenido → cada tarjeta", href: "/content" },
  review: { label: "Reseñas → detalle", href: "/gbp/reviews" },
  gbp_profile: { label: "Perfil GBP", href: "/gbp/profiles" },
  audit: { label: "Auditorías", href: "/audits" },
  none: { label: "Auditorías → Nueva auditoría", href: "/audits" },
};

export default async function AutomationsPage() {
  const actor = await requireAdminPage();
  const webhooks = isN8nConfigured();
  const apiConfigured = isN8nApiConfigured();

  let executions: N8nExecution[] = [];
  let executionsError: string | null = null;
  if (apiConfigured) {
    try {
      executions = await listN8nExecutions(50);
    } catch (e) {
      executionsError = e instanceof Error ? e.message : "No se pudo leer n8n";
    }
  }

  const [gbpErrors, msgErrors] = await Promise.all([listGbpErrors(actor, { take: 50 }), listMessageErrors(actor, 50)]);

  const rows: Row[] = [
    ...executions.map((e) => ({
      id: `n8n-${e.id}`,
      name: e.workflowName ?? `Workflow ${e.workflowId}`,
      client: null,
      type: `n8n · ${e.mode ?? "—"}`,
      at: e.startedAt ? new Date(e.startedAt) : null,
      status: e.status,
      durationMs: e.durationMs,
      error: e.status === "error" || e.status === "crashed" ? "Ver detalle en n8n" : null,
    })),
    ...recentActivity(100)
      .filter((a) => a.action.startsWith("n8n:"))
      .map((a) => ({
        id: `panel-${a.id}`,
        name: a.message?.split(":")[0] ?? a.action,
        client: a.clientLabel ? { label: a.clientLabel } : null,
        type: "Lanzada desde el panel",
        at: new Date(a.at),
        status: a.result,
        durationMs: a.durationMs ?? null,
        error: a.result === "ERROR" ? (a.message ?? null) : null,
      })),
    ...gbpErrors.map((e) => ({
      id: `gbp-${e.id}`,
      name: `Reseñas GBP · ${e.stage ?? "error"}`,
      client: e.gbpClient ? { label: e.gbpClient.businessName ?? `Perfil ${e.gbpClient.id}`, href: `/gbp/profiles/${e.gbpClient.id}` } : null,
      type: "Google Business",
      at: e.createdAt,
      status: "ERROR",
      durationMs: null,
      error: e.errorMessage,
    })),
    ...msgErrors.map((m) => ({
      id: `msg-${m.providerMessageId}`,
      name: "Procesado de mensajes WhatsApp",
      client: m.client ? { label: m.client.clientName ?? "Cliente", href: `/clients/${m.client.clientId}` } : null,
      type: "Contenido",
      at: m.receivedAt,
      status: m.status ?? "ERROR",
      durationMs: null,
      error: m.error,
    })),
  ]
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, 150);

  return (
    <>
      <PageHeader title="Automatizaciones" description="Workflows de n8n: catálogo, ejecuciones y errores. El panel nunca ejecuta procesos pesados: los delega a n8n." />

      <div className="grid gap-3 md:grid-cols-2">
        <ConfigCard
          ok={webhooks}
          title="Webhooks de n8n"
          okText="Configurados. Las acciones del panel se envían a n8n firmadas con el secreto compartido."
          koText="Faltan N8N_WEBHOOK_BASE_URL y/o N8N_WEBHOOK_SECRET. Los botones de automatización devolverán error."
        />
        <ConfigCard
          ok={apiConfigured && !executionsError}
          title="API de ejecuciones de n8n (opcional)"
          okText="Conectada. Se muestran las últimas ejecuciones reales de n8n."
          koText={executionsError ? `Error al leer n8n: ${executionsError}` : "Configura N8N_API_URL y N8N_API_KEY para ver las ejecuciones de n8n aquí."}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de ejecuciones y errores</CardTitle>
          <CardDescription>Ejecuciones de n8n, acciones lanzadas desde el panel y errores registrados en PostgreSQL.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Sin ejecuciones ni errores registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="pl-6">Nombre</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Última ejecución</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead className="pr-6">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm">
                        {r.client ? (
                          r.client.href ? (
                            <Link href={r.client.href} className="hover:underline">
                              {r.client.label}
                            </Link>
                          ) : (
                            r.client.label
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{r.type}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{formatDuration(r.durationMs)}</TableCell>
                      <TableCell className="max-w-md pr-6 text-sm break-words whitespace-normal text-destructive">{r.error ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="size-4" /> Catálogo de workflows
          </CardTitle>
          <CardDescription>
            Acciones que el panel puede solicitar a n8n. Las rutas de webhook se configuran por variable de entorno (ver README).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="pl-6">Workflow</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead className="pr-6">Dónde se lanza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publicWorkflowList().map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="pl-6">
                      <p className="font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.description}</p>
                    </TableCell>
                    <TableCell className="text-sm">{CATEGORY_LABEL[w.category]}</TableCell>
                    <TableCell className="font-mono text-xs">{w.id}</TableCell>
                    <TableCell className="pr-6 text-sm">
                      <Link href={WHERE[w.resource].href} className="text-primary hover:underline">
                        {WHERE[w.resource].label}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ConfigCard({ ok, title, okText, koText }: { ok: boolean; title: string; okText: string; koText: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="mt-0.5 size-5 shrink-0 text-amber-500" />
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{ok ? okText : koText}</p>
      </div>
    </div>
  );
}
