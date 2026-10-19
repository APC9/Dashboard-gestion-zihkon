import { AlertTriangle, CheckCircle2, Clock, Images, Inbox, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IntakeCard } from "@/components/content/intake-card";
import { MediaCard } from "@/components/content/media-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { NavTabs } from "@/components/shared/nav-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/url-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth/session";
import { contentCounts, listActiveSessions, listIntakes, listMessageErrors, listRecentSessionMedia } from "@/lib/data/content";
import type { Actor } from "@/lib/auth/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { contentListQuerySchema } from "@/lib/validation/content";

export const metadata: Metadata = { title: "Contenido" };

const TABS = [
  { value: "inbox", label: "Contenido recibido" },
  { value: "sessions", label: "Sesiones activas" },
  { value: "media", label: "Medios recibidos" },
  { value: "errors", label: "Errores" },
];

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.tab) ? sp.tab : "inbox";
  const counts = await contentCounts(actor);

  return (
    <>
      <PageHeader title="Contenido" description="Fotos y vídeos recibidos por WhatsApp, sesiones en curso y estado de la generación de contenido." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Recibidos" value={counts.received} icon={Inbox} href="/content" />
        <StatCard label="Pendientes" value={counts.pending} icon={Clock} href="/content?status=pending" tone={counts.pending ? "warning" : "default"} />
        <StatCard label="Listos" value={counts.ready} icon={CheckCircle2} href="/content?status=ready" tone="success" />
        <StatCard label="Sesiones activas" value={counts.activeSessions} icon={MessageSquare} href="/content?tab=sessions" />
        <StatCard label="Errores" value={counts.errors} icon={AlertTriangle} href="/content?tab=errors" tone={counts.errors ? "danger" : "default"} />
      </div>
      <NavTabs basePath="/content" active={tab} tabs={TABS} />
      {tab === "inbox" && <InboxTab actor={actor} sp={sp} />}
      {tab === "sessions" && <SessionsTab actor={actor} />}
      {tab === "media" && <MediaTab actor={actor} />}
      {tab === "errors" && <ErrorsTab actor={actor} />}
    </>
  );
}

async function InboxTab({ actor, sp }: { actor: Actor; sp: Record<string, string> }) {
  const parsed = contentListQuerySchema.safeParse({ ...sp, pageSize: sp.pageSize ?? "24" });
  const query = parsed.success ? parsed.data : contentListQuerySchema.parse({ pageSize: 24 });
  const result = await listIntakes(actor, query);
  return (
    <>
      <FilterBar>
        <SearchFilter placeholder="Cliente o descripción…" />
        <SelectFilter
          param="status"
          label="Estado"
          options={[
            { value: "all", label: "Todos" },
            { value: "pending", label: "Pendientes" },
            { value: "ready", label: "Listos" },
            { value: "done", label: "Finalizados" },
            { value: "error", label: "Con error" },
          ]}
        />
        <ClearFilters keys={["q", "status", "clientId"]} />
      </FilterBar>
      {result.items.length === 0 ? (
        <EmptyState icon={Images} title="No hay contenido" description="Cuando un cliente envíe fotos o vídeos por WhatsApp aparecerán aquí." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {result.items.map((i) => (
            <IntakeCard key={i.intakeId} intake={i} />
          ))}
        </div>
      )}
      <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} label="contenidos" />
    </>
  );
}

async function SessionsTab({ actor }: { actor: Actor }) {
  const sessions = await listActiveSessions(actor);
  if (!sessions.length) return <EmptyState icon={MessageSquare} title="No hay sesiones activas" description="Las sesiones se abren cuando un cliente empieza a enviar contenido por WhatsApp." />;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Medios</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Caduca</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.sessionId}>
                <TableCell>
                  {s.client ? (
                    <Link href={`/clients/${s.client.clientId}?tab=content`} className="font-medium hover:underline">
                      {s.client.clientName}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{s.remoteJid}</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
                <TableCell>{s.mediaType ?? "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {s._count.media}
                  {s.mediaCount != null && s.mediaCount !== s._count.media ? ` / ${s.mediaCount}` : ""}
                </TableCell>
                <TableCell className="max-w-64 truncate text-sm text-muted-foreground">{s.description ?? "—"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{formatRelative(s.createdAt)}</TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(s.expiresAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

async function MediaTab({ actor }: { actor: Actor }) {
  const media = await listRecentSessionMedia(actor, 48);
  if (!media.length) return <EmptyState icon={Images} title="No hay medios recibidos" />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {media.map((m) => (
        <div key={m.sessionMediaId} className="flex flex-col gap-1">
          <MediaCard
            item={{
              id: m.sessionMediaId,
              name: m.filename,
              mediaType: m.mediaType,
              mimeType: m.mimeType,
              url: m.mediaReference,
              position: m.position,
              createdAt: m.messageTimestamp ?? m.createdAt,
              fileSize: m.fileSize?.toString() ?? null,
              status: m.status,
              caption: m.caption,
            }}
          />
          <span className="truncate px-1 text-xs text-muted-foreground">{m.session?.client?.clientName ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

async function ErrorsTab({ actor }: { actor: Actor }) {
  const errors = await listMessageErrors(actor);
  if (!errors.length) return <EmptyState icon={CheckCircle2} title="Sin errores" description="No hay mensajes con error en processed_messages." />;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((e) => (
              <TableRow key={e.providerMessageId}>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(e.receivedAt)}</TableCell>
                <TableCell>
                  {e.client ? (
                    <Link href={`/clients/${e.client.clientId}`} className="hover:underline">
                      {e.client.clientName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-48 truncate font-mono text-xs">{e.providerMessageId}</TableCell>
                <TableCell>
                  <StatusBadge status={e.status} />
                </TableCell>
                <TableCell className="max-w-xl text-sm break-words whitespace-normal text-destructive">{e.error ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
