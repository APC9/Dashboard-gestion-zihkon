import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunWorkflowButton } from "@/components/automations/run-workflow-button";
import { GbpBacklogPanel } from "@/components/gbp/gbp-backlog-panel";
import { DeleteGbpProfileButton } from "@/components/gbp/gbp-profile-actions";
import { GbpProfileForm } from "@/components/gbp/gbp-profile-form";
import { ReviewSummary } from "@/components/gbp/review-summary";
import { PageHeader } from "@/components/shared/page-header";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundError } from "@/lib/api/errors";
import { requireAdminPage } from "@/lib/auth/session";
import { getBacklogInfo, getGbpProfile, reviewSummary } from "@/lib/data/gbp";
import { WORKFLOWS } from "@/lib/n8n/workflows";
import { z } from "zod";

export const metadata: Metadata = { title: "Perfil de Google Business" };

export default async function GbpProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const profile = await getGbpProfile(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [summary, backlog] = await Promise.all([reviewSummary(actor, [id]), getBacklogInfo(actor, id)]);
  const name = profile.client.clientName ?? "Perfil sin nombre";

  return (
    <>
      <PageHeader
        back={{ href: "/gbp/profiles", label: "Perfiles" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name} <ActiveBadge active={profile.active} />
          </span>
        }
        description={profile.locationId}
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
            <DeleteGbpProfileButton id={profile.id} businessName={name} redirectTo="/gbp/profiles" />
          </>
        }
      />
      <GbpBacklogPanel profileId={profile.id} info={backlog} canEdit />
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
            <CardDescription>El nombre y el WhatsApp del negocio se gestionan en la ficha del cliente.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Link href={`/clients/${profile.clientId}?tab=gbp`} className="font-medium hover:underline">
              {name}
            </Link>
            <span className="font-mono text-muted-foreground">{profile.client.whatsappE164 ?? "Sin WhatsApp"}</span>
          </CardContent>
        </Card>
      </div>
      <ReviewSummary summary={summary} href={`/gbp/reviews?gbpClientId=${profile.id}`} />
    </>
  );
}
