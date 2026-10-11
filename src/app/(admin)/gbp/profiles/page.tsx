import { Plus, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { GbpNav } from "@/components/gbp/gbp-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge } from "@/components/shared/status-badge";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth/session";
import { listGbpProfiles } from "@/lib/data/gbp";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Perfiles de Google Business" };

const querySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["all", "active", "inactive"]).catch("all"),
});

export default async function GbpProfilesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const query = querySchema.parse(await searchParams);
  const profiles = await listGbpProfiles(actor, query);

  return (
    <>
      <PageHeader
        title="Google Business"
        description="Perfiles de Google Business Profile gestionados por la automatización de reseñas."
        actions={
          <Button asChild>
            <Link href="/gbp/profiles/new">
              <Plus className="size-4" /> Nuevo perfil
            </Link>
          </Button>
        }
      >
        <GbpNav active="profiles" />
      </PageHeader>
      <FilterBar>
        <SearchFilter placeholder="Negocio, Location ID, email…" />
        <SelectFilter
          param="status"
          label="Estado"
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Activos" },
            { value: "inactive", label: "Inactivos" },
          ]}
        />
      </FilterBar>
      {profiles.length === 0 ? (
        <EmptyState icon={Star} title="No hay perfiles" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Location ID</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Modo de respuesta</TableHead>
                  <TableHead>Tono</TableHead>
                  <TableHead>Reseñas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última actualización</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/gbp/profiles/${p.id}`} className="font-medium hover:underline">
                        {p.client.clientName ?? "Sin nombre"}
                      </Link>
                      {p.businessType ? <p className="text-xs text-muted-foreground">{p.businessType}</p> : null}
                    </TableCell>
                    <TableCell className="max-w-44 truncate font-mono text-xs">{p.locationId ?? "—"}</TableCell>
                    <TableCell className="uppercase">{p.preferredLanguage ?? "—"}</TableCell>
                    <TableCell>{p.responseMode ?? "—"}</TableCell>
                    <TableCell className="capitalize">{p.responseTone ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {p._count.reviews}
                      {p.pendingReviews ? (
                        <Link href={`/gbp/reviews?gbpClientId=${p.id}&status=pending`} className="ml-1.5 text-xs text-amber-600 hover:underline dark:text-amber-400">
                          ({p.pendingReviews} pend.)
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={p.active} />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt ?? p.createdAt)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/gbp/reviews?gbpClientId=${p.id}`}>Reseñas</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/gbp/profiles/${p.id}`}>Editar</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
