import type { Metadata } from "next";
import Link from "next/link";
import { GbpNav } from "@/components/gbp/gbp-nav";
import { ReviewsTable } from "@/components/gbp/reviews-table";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/url-filters";
import { requireAdminPage } from "@/lib/auth/session";
import { loadClientIndexForGbp } from "@/lib/data/client-links";
import { listGbpProfiles, listReviews } from "@/lib/data/gbp";
import { REVIEW_STATUSES, statusLabel } from "@/lib/status";
import { reviewListQuerySchema } from "@/lib/validation/gbp";

export const metadata: Metadata = { title: "Reseñas" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const parsed = reviewListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : reviewListQuerySchema.parse({});
  const [result, clientIndex, profiles] = await Promise.all([
    listReviews(actor, query),
    loadClientIndexForGbp(actor),
    listGbpProfiles(actor),
  ]);
  const profileName = query.gbpClientId ? profiles.find((p) => p.id === query.gbpClientId)?.businessName : null;

  const rows = result.items.map((r) => ({
    ...r,
    zihkonClient: r.clientId != null ? (clientIndex.get(r.clientId) ?? null) : null,
  }));

  return (
    <>
      <PageHeader
        title="Google Business"
        description={
          profileName ? (
            <>
              Reseñas de <strong>{profileName}</strong> ·{" "}
              <Link href="/gbp/reviews" className="text-primary hover:underline">
                ver todas
              </Link>
            </>
          ) : (
            "Bandeja de gestión de reseñas y respuestas generadas por IA."
          )
        }
      >
        <GbpNav active="reviews" />
      </PageHeader>
      <FilterBar>
        <SearchFilter placeholder="Autor, texto, negocio o Review ID…" />
        <SelectFilter
          param="status"
          label="Estado"
          options={[
            { value: "all", label: "Todos los estados" },
            { value: "pending", label: "Requieren acción" },
            ...REVIEW_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
          ]}
        />
        <SelectFilter
          param="rating"
          label="Rating"
          className="sm:w-36"
          options={[{ value: "all", label: "Cualquier rating" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` }))]}
        />
        <SelectFilter
          param="gbpClientId"
          label="Negocio"
          className="sm:w-56"
          options={[{ value: "all", label: "Todos los negocios" }, ...profiles.map((p) => ({ value: String(p.id), label: p.businessName ?? `Perfil ${p.id}` }))]}
        />
        <ClearFilters keys={["q", "status", "rating", "gbpClientId"]} />
      </FilterBar>
      <ReviewsTable rows={rows} />
      <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} label="reseñas" />
    </>
  );
}
