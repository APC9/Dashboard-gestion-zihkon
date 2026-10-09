import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunWorkflowButton } from "@/components/automations/run-workflow-button";
import { GbpProfileForm } from "@/components/gbp/gbp-profile-form";
import { ReviewSummary } from "@/components/gbp/review-summary";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundError } from "@/lib/api/errors";
import { requireAdminPage } from "@/lib/auth/session";
import { findClientsForGbp } from "@/lib/data/client-links";
import { getGbpProfile, reviewSummary } from "@/lib/data/gbp";
import { WORKFLOWS } from "@/lib/n8n/workflows";

export const metadata: Metadata = { title: "Perfil de Google Business" };

export default async function GbpProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const profile = await getGbpProfile(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [summary, linkedClients] = await Promise.all([reviewSummary(actor, [id]), findClientsForGbp(actor, profile)]);

  return (
    <>
      <PageHeader
        back={{ href: "/gbp/profiles", label: "Perfiles" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {profile.businessName ?? "Perfil sin nombre"} <ActiveBadge active={profile.active} />
          </span>
        }
        description={`ID ${profile.id} · ${profile.locationId ?? "sin Location ID"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/gbp/reviews?gbpClientId=${profile.id}`}>Ver reseñas</Link>
            </Button>
            <RunWorkflowButton
              workflowId={WORKFLOWS.gbpSyncReviews.id}
              name={WORKFLOWS.gbpSyncReviews.name}
              description={WORKFLOWS.gbpSyncReviews.description}
              resourceId={profile.id}
              label="Sincronizar reseñas"
              size="default"
            />
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración</CardTitle>
            <CardDescription>Se guarda en gbp_clients. n8n la lee en cada ejecución.</CardDescription>
          </CardHeader>
          <CardContent>
            <GbpProfileForm initial={profile} />
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Cliente Zihkon</CardTitle>
            <CardDescription>Vínculo deducido (no existe relación en la base de datos).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {linkedClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún cliente coincide por WhatsApp o nombre.</p>
            ) : (
              linkedClients.map((c) => (
                <Link key={c.clientId} href={`/clients/${c.clientId}?tab=gbp`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/50">
                  <span className="truncate text-sm font-medium">{c.clientName}</span>
                  <StatusBadge tone={c.matchedBy === "whatsapp" ? "success" : "warning"} label={c.matchedBy === "whatsapp" ? "WhatsApp" : "Nombre"} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <ReviewSummary summary={summary} href={`/gbp/reviews?gbpClientId=${profile.id}`} />
    </>
  );
}
