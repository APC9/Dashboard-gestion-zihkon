import { Download, ExternalLink, FolderOpen, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditReport, GooglePlacesCard } from "@/components/audits/audit-report";
import { RawJson } from "@/components/shared/json-view";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/api/errors";
import { requireAdminPage } from "@/lib/auth/session";
import { getAudit } from "@/lib/data/audits";
import { driveViewUrl } from "@/lib/drive";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage();
  const { id } = await params;
  if (!/^\d{1,19}$/.test(id)) notFound();
  const audit = await getAudit(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const drive = driveViewUrl(null, audit.driveFileId);

  return (
    <>
      <PageHeader
        back={{ href: "/audits", label: "Auditorías" }}
        title={audit.nombreNegocio ?? "Auditoría"}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {audit.direccion ?? "Sin dirección"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4" /> {audit.email ?? "Sin email"}
            </span>
            <span>Generada: {formatDateTime(audit.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {audit.pdfUrl ? (
              <Button asChild>
                <a href={audit.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" /> Abrir PDF
                </a>
              </Button>
            ) : null}
            {drive ? (
              <Button asChild variant="outline">
                <a href={drive} target="_blank" rel="noopener noreferrer">
                  <FolderOpen className="size-4" /> Drive
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <a href={`/api/audits/${audit.id}/download`}>
                <Download className="size-4" /> Descargar
              </a>
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Informe</h2>
        <AuditReport informe={audit.informe} />
      </section>

      <GooglePlacesCard data={audit.googlePlaces} />

      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground select-none hover:text-foreground">
          Ver informe en formato técnico (JSON)
        </summary>
        <div className="border-t p-4">
          <RawJson data={audit.informe} />
        </div>
      </details>
    </>
  );
}
