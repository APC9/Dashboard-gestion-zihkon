"use client";

import { ExternalLink, FileAudio, FileText, FileVideo, ImageOff } from "lucide-react";
import { useState } from "react";
import { driveThumbnailUrl, driveViewUrl, isImage, isVideo } from "@/lib/drive";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";

export interface MediaItem {
  id: string;
  name: string | null;
  mediaType: string | null;
  mimeType: string | null;
  driveUrl: string | null;
  driveFileId: string | null;
  position: number | null;
  createdAt: Date | string | null;
  fileSize?: string | number | null;
  status?: string | null;
  caption?: string | null;
}

/**
 * Preview de un archivo de Drive. Solo carga la miniatura pública (sin
 * credenciales). Si falla o no hay URL, muestra la ficha del archivo.
 */
export function MediaThumb({ item, className }: { item: MediaItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  const thumb = isImage(item.mediaType, item.mimeType) ? driveThumbnailUrl(item.driveUrl, item.driveFileId, 400) : null;
  const Icon = isVideo(item.mediaType, item.mimeType)
    ? FileVideo
    : (item.mimeType ?? "").startsWith("audio/")
      ? FileAudio
      : isImage(item.mediaType, item.mimeType)
        ? ImageOff
        : FileText;

  return (
    <div className={cn("relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/40", className)}>
      {thumb && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={item.name ?? "Archivo"}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 p-2 text-center">
          <Icon className="size-6 text-muted-foreground" />
          <span className="line-clamp-2 text-[11px] break-all text-muted-foreground">{item.name ?? item.mimeType ?? "Archivo"}</span>
        </div>
      )}
      {item.position != null ? (
        <span className="absolute top-1 left-1 rounded bg-background/85 px-1.5 text-[10px] font-semibold tabular-nums">#{item.position}</span>
      ) : null}
    </div>
  );
}

export function MediaCard({ item }: { item: MediaItem }) {
  const view = driveViewUrl(item.driveUrl, item.driveFileId);
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2">
      <MediaThumb item={item} />
      <div className="space-y-1 px-1 pb-1 text-xs">
        <p className="truncate text-sm font-medium" title={item.name ?? undefined}>
          {item.name ?? "Sin nombre"}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
          <dt>Tipo</dt>
          <dd className="truncate">{item.mimeType ?? item.mediaType ?? "—"}</dd>
          {item.fileSize != null ? (
            <>
              <dt>Tamaño</dt>
              <dd>{formatBytes(item.fileSize)}</dd>
            </>
          ) : null}
          <dt>Posición</dt>
          <dd>{item.position ?? "—"}</dd>
          <dt>Fecha</dt>
          <dd>{formatDateTime(item.createdAt)}</dd>
        </dl>
        {item.caption ? <p className="line-clamp-2 italic">“{item.caption}”</p> : null}
        <div className="flex items-center justify-between gap-2 pt-1">
          {item.status ? <StatusBadge status={item.status} /> : <span />}
          {view ? (
            <a href={view} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Drive <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="text-muted-foreground">Sin URL pública</span>
          )}
        </div>
      </div>
    </div>
  );
}
