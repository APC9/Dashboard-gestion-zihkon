import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { GbpNav } from "@/components/gbp/gbp-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar, SearchFilter } from "@/components/shared/url-filters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth/session";
import { listGbpErrors } from "@/lib/data/gbp";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Errores de Google Business" };

const querySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  gbpClientId: z.coerce.number().int().positive().optional().catch(undefined),
});

export default async function GbpErrorsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const query = querySchema.parse(await searchParams);
  const errors = await listGbpErrors(actor, query);

  return (
    <>
      <PageHeader title="Google Business" description="Errores registrados por la automatización de reseñas (gbp_automation_errors).">
        <GbpNav active="errors" />
      </PageHeader>
      <FilterBar>
        <SearchFilter placeholder="Mensaje o etapa…" />
      </FilterBar>
      {errors.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Sin errores" description="La automatización de reseñas no ha registrado errores." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Reseña</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                    <TableCell>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{e.stage ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.gbpClient ? (
                        <Link href={`/gbp/profiles/${e.gbpClient.id}`} className="hover:underline">
                          {e.gbpClient.businessName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.review ? (
                        <Link href={`/gbp/reviews/${e.review.id}`} className="hover:underline">
                          {e.review.reviewerName ?? e.review.reviewId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xl text-sm break-words whitespace-normal text-destructive">{e.errorMessage}</TableCell>
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
