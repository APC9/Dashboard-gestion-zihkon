import { ClipboardCheck, Download, ExternalLink, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditGenerateDialog } from "@/components/audits/audit-generate-dialog";
import { DateRangeFilter } from "@/components/shared/date-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ClearFilters, FilterBar, SearchFilter } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth/session";
import { listAudits } from "@/lib/data/audits";
import { formatDateTime } from "@/lib/format";
import { auditListQuerySchema } from "@/lib/validation/content";

export const metadata: Metadata = { title: "Auditorías" };

export default async function AuditsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const parsed = auditListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : auditListQuerySchema.parse({});
  const result = await listAudits(actor, query);

  return (
    <>
      <PageHeader title="Auditorías" description="Auditorías de presencia local generadas por n8n (auditorias_locales)." actions={<AuditGenerateDialog />} />
      <FilterBar>
        <SearchFilter placeholder="Nombre, email o dirección…" />
        <DateRangeFilter />
        <ClearFilters keys={["q", "from", "to"]} />
      </FilterBar>
      {result.items.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No hay auditorías" description="Prueba a cambiar los filtros o genera una nueva auditoría." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/audits/${a.id}`} className="font-medium hover:underline">
                        {a.nombreNegocio ?? "Sin nombre"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{a.email ?? "—"}</TableCell>
                    <TableCell className="max-w-72 truncate text-sm text-muted-foreground">{a.direccion ?? "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/audits/${a.id}`}>
                            <FileText className="size-4" /> Ver
                          </Link>
                        </Button>
                        {a.pdfUrl ? (
                          <Button asChild size="sm" variant="ghost" title="Abrir PDF">
                            <a href={a.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" /> PDF
                            </a>
                          </Button>
                        ) : null}
                        <Button asChild size="icon" variant="ghost" className="size-8" title="Descargar informe (JSON)">
                          <a href={`/api/audits/${a.id}/download`} aria-label="Descargar informe">
                            <Download className="size-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} label="auditorías" />
    </>
  );
}
