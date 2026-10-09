import { ExternalLink, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { IntakeActions } from "@/components/content/intake-actions";
import { MediaCard } from "@/components/content/media-preview";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundError } from "@/lib/api/errors";
import { requireAdminPage } from "@/lib/auth/session";
import { getIntake } from "@/lib/data/content";
import { driveFolderUrl } from "@/lib/drive";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Contenido" };

export default async function IntakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const intake = await getIntake(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const folder = driveFolderUrl(intake.client?.driveFolderId);

  return (
    <>
      <PageHeader
        back={{ href: "/content", label: "Contenido" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Contenido de {intake.client?.clientName ?? "cliente desconocido"} <StatusBadge status={intake.status} />
          </span>
        }
        description={`Recibido ${formatDateTime(intake.createdAt)} · ${intake.media.length} archivo(s)${intake.expectedCount ? ` de ${intake.expectedCount} esperados` : ""}`}
        actions={
          folder ? (
            <a href={folder} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <FolderOpen className="size-4" /> Carpeta de Drive <ExternalLink className="size-3" />
            </a>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descripción</CardTitle>
          <CardDescription>Contexto que se envía a la IA para generar el contenido.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm whitespace-pre-wrap">{intake.description || <em className="text-muted-foreground">Sin descripción</em>}</p>
          <IntakeActions intakeId={intake.intakeId} description={intake.description} variant="buttons" />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Archivos</h2>
        {intake.media.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay archivos en content_media para este contenido.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {intake.media.map((m) => (
              <MediaCard
                key={m.mediaId}
                item={{
                  id: m.mediaId,
                  name: m.originalFileName,
                  mediaType: m.mediaType,
                  mimeType: m.mimeType,
                  driveUrl: m.driveUrl,
                  driveFileId: m.driveFileId,
                  position: m.position,
                  createdAt: m.createdAt,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {intake.sessions.map((s) => (
        <section key={s.sessionId} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Sesión de WhatsApp</h2>
            <StatusBadge status={s.status} />
            <span className="text-sm text-muted-foreground">
              {formatDateTime(s.createdAt)}
              {s.completedAt ? ` → ${formatDateTime(s.completedAt)}` : ""}
            </span>
          </div>
          {s.media.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {s.media.map((m) => (
                <MediaCard
                  key={m.sessionMediaId}
                  item={{
                    id: m.sessionMediaId,
                    name: m.filename,
                    mediaType: m.mediaType,
                    mimeType: m.mimeType,
                    driveUrl: m.driveUrl,
                    driveFileId: m.driveFileId,
                    position: m.position,
                    createdAt: m.messageTimestamp ?? m.createdAt,
                    fileSize: m.fileSize?.toString() ?? null,
                    status: m.status,
                    caption: m.caption,
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin medios en esta sesión.</p>
          )}
        </section>
      ))}

      {intake.client ? (
        <Link href={`/clients/${intake.client.clientId}?tab=content`} className="text-sm text-primary hover:underline">
          Ver todo el contenido de {intake.client.clientName} →
        </Link>
      ) : null}
    </>
  );
}
