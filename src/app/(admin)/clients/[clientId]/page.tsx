import { CalendarDays, ExternalLink, FileSpreadsheet, FolderOpen, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientStatusButton } from "@/components/clients/client-actions";
import { ActiveBadge } from "@/components/shared/status-badge";
import { NavTabs } from "@/components/shared/nav-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundError } from "@/lib/api/errors";
import { requireAdminPage } from "@/lib/auth/session";
import { getClientOverview } from "@/lib/data/clients";
import { driveFolderUrl, googleSheetUrl } from "@/lib/drive";
import { formatDate, whatsappLink } from "@/lib/format";
import { z } from "zod";
import {
  ActivityTab,
  AuditsTab,
  AutomationsTab,
  ContentTab,
  GbpTab,
  GeneralTab,
  WebTab,
} from "./tabs";

const TABS = [
  { value: "general", label: "General" },
  { value: "web", label: "Web" },
  { value: "gbp", label: "Google Business" },
  { value: "content", label: "Contenido" },
  { value: "audits", label: "Auditorías" },
  { value: "automations", label: "Automatizaciones" },
  { value: "activity", label: "Actividad" },
] as const;
type Tab = (typeof TABS)[number]["value"];

type Props = { params: Promise<{ clientId: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { clientId } = await params;
  return { title: z.string().uuid().safeParse(clientId).success ? "Ficha de cliente" : "Cliente no encontrado" };
}

export default async function ClientDetailPage({ params, searchParams }: Props) {
  const actor = await requireAdminPage();
  const { clientId } = await params;
  const { tab: rawTab } = await searchParams;
  if (!z.string().uuid().safeParse(clientId).success) notFound();

  const overview = await getClientOverview(actor, clientId).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { client, websites, gbpLinks, counts } = overview;
  const tab: Tab = TABS.some((t) => t.value === rawTab) ? (rawTab as Tab) : "general";
  const name = client.clientName ?? "Cliente sin nombre";
  const wa = whatsappLink(client.whatsappE164);

  return (
    <>
      <PageHeader
        back={{ href: "/clients", label: "Clientes" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name} <ActiveBadge active={client.active} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-4" />
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
                  {client.whatsappE164}
                </a>
              ) : (
                "Sin WhatsApp"
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Alta: {formatDate(client.createdAt)}
            </span>
            {client.driveFolderId ? (
              <a href={driveFolderUrl(client.driveFolderId)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                <FolderOpen className="size-4" /> Drive <ExternalLink className="size-3" />
              </a>
            ) : null}
            {client.googleSheetId ? (
              <a href={googleSheetUrl(client.googleSheetId)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                <FileSpreadsheet className="size-4" /> Sheet <ExternalLink className="size-3" />
              </a>
            ) : null}
          </span>
        }
        actions={<ClientStatusButton clientId={client.clientId} clientName={name} active={client.active === true} />}
      />

      <NavTabs
        basePath={`/clients/${client.clientId}`}
        active={tab}
        tabs={TABS.map((t) => ({
          ...t,
          count:
            t.value === "web"
              ? websites.length
              : t.value === "gbp"
                ? gbpLinks.length
                : t.value === "content"
                  ? counts?.contentIntakes
                  : undefined,
        }))}
      />

      {tab === "general" && <GeneralTab client={client} />}
      {tab === "web" && <WebTab clientId={client.clientId} websites={websites} />}
      {tab === "gbp" && <GbpTab actor={actor} client={client} links={gbpLinks} />}
      {tab === "content" && <ContentTab actor={actor} clientId={client.clientId} />}
      {tab === "audits" && <AuditsTab actor={actor} clientName={client.clientName} />}
      {tab === "automations" && <AutomationsTab actor={actor} client={client} websites={websites} />}
      {tab === "activity" && <ActivityTab actor={actor} clientId={client.clientId} />}
    </>
  );
}
