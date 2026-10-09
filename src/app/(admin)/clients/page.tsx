import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClientsTable } from "@/components/clients/clients-table";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth/session";
import { listClients } from "@/lib/data/clients";
import { clientListQuerySchema } from "@/lib/validation/client";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireAdminPage();
  const parsed = clientListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : clientListQuerySchema.parse({});
  const result = await listClients(actor, query);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Todos los clientes de Zihkon y sus servicios."
        actions={
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="size-4" /> Nuevo cliente
            </Link>
          </Button>
        }
      />
      <FilterBar>
        <SearchFilter placeholder="Buscar por nombre o teléfono…" />
        <SelectFilter
          param="status"
          label="Estado"
          options={[
            { value: "all", label: "Todos los estados" },
            { value: "active", label: "Activos" },
            { value: "inactive", label: "Inactivos" },
          ]}
        />
        <SelectFilter
          param="web"
          label="Web"
          options={[
            { value: "all", label: "Con y sin web" },
            { value: "yes", label: "Tiene web" },
            { value: "no", label: "Sin web" },
          ]}
        />
        <SelectFilter
          param="gbp"
          label="GBP"
          options={[
            { value: "all", label: "Con y sin GBP" },
            { value: "yes", label: "Tiene GBP" },
            { value: "no", label: "Sin GBP" },
          ]}
        />
        <ClearFilters keys={["q", "status", "web", "gbp"]} />
      </FilterBar>
      <ClientsTable rows={result.items} />
      <PaginationBar page={result.page} pageCount={result.pageCount} total={result.total} label="clientes" />
    </>
  );
}
