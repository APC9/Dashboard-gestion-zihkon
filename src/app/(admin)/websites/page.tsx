import { ExternalLink, GitBranch, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth/session";
import { listWebsites } from "@/lib/data/websites";
import { formatDate, githubUrl } from "@/lib/format";

export const metadata: Metadata = { title: "Webs" };

const querySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
});

export default async function WebsitesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const query = querySchema.parse(await searchParams);
  const sites = await listWebsites(actor, query);

  return (
    <>
      <PageHeader title="Webs" description="Webs de clientes: repositorio GitHub, sitio Netlify y estado. Se editan desde la ficha del cliente." />
      <FilterBar>
        <SearchFilter placeholder="URL, repositorio, cliente…" />
        <SelectFilter
          param="status"
          label="Estado"
          options={[
            { value: "all", label: "Todas" },
            { value: "active", label: "Activas" },
            { value: "inactive", label: "Inactivas" },
          ]}
        />
      </FilterBar>
      {sites.length === 0 ? (
        <EmptyState icon={Globe} title="No hay webs" description="Añade una web desde la pestaña Web de un cliente." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Web</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Repositorio</TableHead>
                  <TableHead>Rama</TableHead>
                  <TableHead>Netlify</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Actualizada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((s) => {
                  const gh = githubUrl(s.githubOwner, s.githubRepository);
                  return (
                    <TableRow key={s.websiteId}>
                      <TableCell className="max-w-56">
                        {s.websiteUrl ? (
                          <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-primary hover:underline">
                            <span className="truncate">{s.websiteUrl.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Sin URL</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.client ? (
                          <Link href={`/clients/${s.client.clientId}?tab=web`} className="hover:underline">
                            {s.client.clientName}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {gh ? (
                          <a href={gh} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                            <GitBranch className="size-3.5" /> {s.githubOwner}/{s.githubRepository}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.defaultBranch ?? "—"}</TableCell>
                      <TableCell className="max-w-32 truncate font-mono text-xs">{s.netlifySiteId ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge tone={s.previewModeEnabled ? "info" : "neutral"} label={s.previewModeEnabled ? "Activo" : "No"} />
                      </TableCell>
                      <TableCell>
                        <ActiveBadge active={s.active} />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(s.updatedAt ?? s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/clients/${s.clientId}?tab=web`}>Gestionar</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
