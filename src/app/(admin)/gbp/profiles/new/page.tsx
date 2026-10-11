import type { Metadata } from "next";
import { GbpProfileForm } from "@/components/gbp/gbp-profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Nuevo perfil de Google Business" };

export default async function NewGbpProfilePage({ searchParams }: { searchParams: Promise<{ clientId?: string; accountId?: string; locationId?: string }> }) {
  await requireAdminPage();
  const clients = await prisma.client.findMany({
    select: { clientId: true, clientName: true, whatsappE164: true },
    orderBy: { clientName: "asc" },
  });
  // ?clientId=… preselecciona el cliente (p. ej. «Añadir otra ubicación» desde su ficha).
  // ?accountId=…&locationId=… rellena los IDs (p. ej. «Dar de alta» desde Cuentas de Google).
  const { clientId, accountId, locationId } = await searchParams;
  const preselected = clients.some((c) => c.clientId === clientId) ? clientId : undefined;
  const prefill = (v: string | undefined) => (typeof v === "string" ? v.trim().slice(0, 200) || undefined : undefined);
  return (
    <>
      <PageHeader
        title="Nuevo perfil de Google Business"
        description="Registra un perfil en gbp_clients para que n8n gestione sus reseñas. El nombre y el WhatsApp se toman del cliente que elijas."
        back={{ href: "/gbp/profiles", label: "Perfiles" }}
      />
      <Card className="max-w-4xl">
        <CardContent>
          <GbpProfileForm clients={clients} initial={{ clientId: preselected, accountId: prefill(accountId), locationId: prefill(locationId) }} />
        </CardContent>
      </Card>
    </>
  );
}
