import type { Metadata } from "next";
import { GbpNav } from "@/components/gbp/gbp-nav";
import { GoogleAccountsExplorer } from "@/components/gbp/google-accounts-explorer";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdminPage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cuentas de Google Business" };

export default async function GbpAccountsPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="Google Business"
        description="Cuentas y fichas de Google Business Profile que administra Zihkon, consultadas en Google a través de n8n."
      >
        <GbpNav active="accounts" />
      </PageHeader>
      <GoogleAccountsExplorer />
    </>
  );
}
