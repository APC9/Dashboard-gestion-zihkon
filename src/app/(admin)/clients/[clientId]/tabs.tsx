import { AlertTriangle, ClipboardCheck, ExternalLink, FileText, Globe, Images, MessageSquare, MousePointerClick, Plus, Star } from "lucide-react";
import Link from "next/link";
import { RunWorkflowButton } from "@/components/automations/run-workflow-button";
import { ClientAutomationsToggles } from "@/components/clients/client-automations";
import { ClientForm } from "@/components/clients/client-form";
import { DeleteClientButton } from "@/components/clients/client-actions";
import { IntakeCard } from "@/components/content/intake-card";
import { DeleteGbpProfileButton } from "@/components/gbp/gbp-profile-actions";
import { GbpProfileForm } from "@/components/gbp/gbp-profile-form";
import { ReviewSummary } from "@/components/gbp/review-summary";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WebsitePanel } from "@/components/websites/website-panel";
import type { Client, ClientWebsite } from "@/generated/prisma/client";
import { recentActivityForClient } from "@/lib/activity-log";
import type { Actor } from "@/lib/auth/types";
import { findAuditsForClient } from "@/lib/data/audits";
import { listClientAutomations } from "@/lib/data/automations";
import { getClientActivity, type GbpLink } from "@/lib/data/clients";
import { listIntakes, listMessageErrors } from "@/lib/data/content";
import { reviewSummary } from "@/lib/data/gbp";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { WORKFLOWS } from "@/lib/n8n/workflows";
import { cn } from "@/lib/utils";

export function GeneralTab({ client }: { client: Client }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del cliente</CardTitle>
          <CardDescription>Se guardan directamente en la tabla clients de PostgreSQL.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm initial={client} />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">client_id</p>
            <code className="block rounded bg-muted px-2 py-1 font-mono text-xs break-all">{client.clientId}</code>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Zona peligrosa</CardTitle>
            <CardDescription>
              Es preferible desactivar el cliente. La eliminación solo se permite si no tiene datos asociados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteClientButton clientId={client.clientId} clientName={client.clientName ?? "este cliente"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function WebTab({ clientId, websites }: { clientId: string; websites: ClientWebsite[] }) {
  return <WebsitePanel clientId={clientId} websites={websites} />;
}

export async function GbpTab({ actor, client, links }: { actor: Actor; client: Client; links: GbpLink[] }) {
  const ids = links.map((l) => l.gbpClientId);
  const [profiles, summary] = await Promise.all([
    prisma.gbpClient.findMany({ where: { clientId: client.clientId }, orderBy: { createdAt: "asc" } }),
    reviewSummary(actor, ids),
  ]);

  if (profiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4" /> Crear perfil de Google Business
          </CardTitle>
          <CardDescription>
            Este cliente aún no tiene perfil. Quedará enlazado a él y usará su nombre y su WhatsApp ({client.whatsappE164 ?? "—"}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GbpProfileForm refreshOnCreate initial={{ clientId: client.clientId, active: client.active }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {profiles.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {client.clientName ?? "Perfil sin nombre"} <ActiveBadge active={p.active} />
            </CardTitle>
            <CardDescription>
              {p.locationId} ·{" "}
              <Link href={`/gbp/reviews?gbpClientId=${p.id}`} className="text-primary hover:underline">
                Ver reseñas
              </Link>
            </CardDescription>
            <CardAction>
              <DeleteGbpProfileButton id={p.id} businessName={client.clientName ?? "este perfil"} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <GbpProfileForm initial={p} />
          </CardContent>
        </Card>
      ))}
      <Button asChild variant="outline" className="self-start">
        <Link href={`/gbp/profiles/new?clientId=${client.clientId}`}>
          <Plus className="size-4" /> Añadir otra ubicación
        </Link>
      </Button>
      <ReviewSummary summary={summary} href={ids.length === 1 ? `/gbp/reviews?gbpClientId=${ids[0]}` : "/gbp/reviews"} />
    </div>
  );
}

export async function ContentTab({ actor, clientId }: { actor: Actor; clientId: string }) {
  const result = await listIntakes(actor, { clientId, status: "all", page: 1, pageSize: 24 });
  if (!result.items.length) {
    return <EmptyState icon={Images} title="Sin contenido recibido" description="Cuando el cliente envíe fotos o vídeos por WhatsApp aparecerán aquí." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {result.items.map((i) => (
          <IntakeCard key={i.intakeId} intake={i} showClient={false} />
        ))}
      </div>
      {result.total > result.items.length ? (
        <Button asChild variant="outline" className="self-start">
          <Link href={`/content?clientId=${clientId}`}>Ver los {result.total} contenidos</Link>
        </Button>
      ) : null}
    </div>
  );
}

export async function AuditsTab({ actor, clientName }: { actor: Actor; clientName: string | null }) {
  const audits = await findAuditsForClient(actor, clientName);
  if (!audits.length) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Sin auditorías relacionadas"
        description="Las auditorías no tienen client_id; se buscan por nombre de negocio. Puedes buscarlas manualmente en Auditorías."
        action={
          <Button asChild variant="outline">
            <Link href="/audits">Ir a Auditorías</Link>
          </Button>
        }
      />
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Auditorías con nombre similar</CardTitle>
        <CardDescription>Coincidencia por nombre de negocio (orientativa).</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {audits.map((a) => (
          <div key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`/audits/${a.id}`} className="font-medium hover:underline">
                {a.nombreNegocio}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                {a.direccion ?? "—"} · {a.email ?? "—"} · {formatDate(a.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/audits/${a.id}`}>
                  <FileText className="size-4" /> Ver
                </Link>
              </Button>
              {a.pdfUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={a.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" /> PDF
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export async function AutomationsTab({ actor, client, websites }: { actor: Actor; client: Client; websites: ClientWebsite[] }) {
  const [allErrors, contracted] = await Promise.all([listMessageErrors(actor, 200), listClientAutomations(actor, client.clientId)]);
  const errors = allErrors.filter((e) => e.clientId === client.clientId).slice(0, 20);
  const panelActions = recentActivityForClient(client.clientId, 20);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Automatizaciones contratadas</CardTitle>
          <CardDescription>
            Habilita solo las que el cliente ha contratado. Se guardan en la tabla client_automations.
            {client.active !== true ? " El cliente está desactivado: no recibirá ninguna aunque estén habilitadas." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientAutomationsToggles clientId={client.clientId} items={contracted} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lanzar automatizaciones</CardTitle>
          <CardDescription>Las acciones se envían a n8n mediante webhooks autenticados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          <WorkflowRow
            name={WORKFLOWS.clientOnboarding.name}
            description={WORKFLOWS.clientOnboarding.description}
            action={<RunWorkflowButton workflowId={WORKFLOWS.clientOnboarding.id} name={WORKFLOWS.clientOnboarding.name} resourceId={client.clientId} />}
          />
          {websites.map((w) => (
            <WorkflowRow
              key={w.websiteId}
              icon={<Globe className="size-4" />}
              name={`Web: ${w.websiteUrl?.replace(/^https?:\/\//, "") ?? w.githubRepository ?? "sin URL"}`}
              description="Modificación con IA, preview y publicación"
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={`/clients/${client.clientId}?tab=web`}>Abrir</Link>
                </Button>
              }
            />
          ))}
          <WorkflowRow
            icon={<Images className="size-4" />}
            name={WORKFLOWS.contentGeneration.name}
            description="Se lanza desde cada contenido recibido"
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/clients/${client.clientId}?tab=content`}>Ver contenido</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Errores recientes</CardTitle>
          <CardDescription>Mensajes con error en processed_messages</CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin errores registrados ✨</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {errors.map((e) => (
                <li key={e.providerMessageId} className="flex items-start gap-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0 text-sm">
                    <p className="break-words">{e.error ?? e.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.receivedAt)} · <span className="font-mono">{e.providerMessageId}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Acciones lanzadas desde el panel</CardTitle>
          <CardDescription>Desde el último reinicio del servidor (el histórico permanente requiere la tabla admin_activity_log).</CardDescription>
        </CardHeader>
        <CardContent>
          {panelActions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin acciones recientes</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {panelActions.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <MousePointerClick className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.message ?? a.action}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={a.result} />
                    <span className="text-xs text-muted-foreground">{formatRelative(a.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowRow({ name, description, action, icon }: { name: string; description: string; action: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

const KIND_STYLE = {
  content: { icon: Images, className: "bg-sky-500/15 text-sky-600" },
  session: { icon: MessageSquare, className: "bg-emerald-500/15 text-emerald-600" },
  message: { icon: MessageSquare, className: "bg-muted text-muted-foreground" },
  website: { icon: Globe, className: "bg-violet-500/15 text-violet-600" },
  error: { icon: AlertTriangle, className: "bg-red-500/15 text-red-600" },
} as const;

export async function ActivityTab({ actor, clientId }: { actor: Actor; clientId: string }) {
  const items = await getClientActivity(actor, clientId);
  if (!items.length) return <EmptyState title="Sin actividad registrada" />;
  return (
    <Card>
      <CardContent>
        <ol className="relative flex flex-col gap-4 border-l pl-6">
          {items.map((item) => {
            const style = KIND_STYLE[item.kind];
            return (
              <li key={item.id} className="relative">
                <span className={cn("absolute top-0 -left-[37px] flex size-6 items-center justify-center rounded-full ring-4 ring-card", style.className)}>
                  <style.icon className="size-3" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                {item.detail ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.detail}</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
