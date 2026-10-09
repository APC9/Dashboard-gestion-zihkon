import { Calendar, Images } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { IntakeActions } from "./intake-actions";
import { MediaThumb } from "./media-preview";

export interface IntakeCardData {
  intakeId: string;
  description: string | null;
  status: string | null;
  createdAt: Date | null;
  expectedCount: number | null;
  client: { clientId: string; clientName: string | null } | null;
  media: {
    mediaId: string;
    originalFileName: string | null;
    mediaType: string | null;
    mimeType: string | null;
    driveUrl: string | null;
    driveFileId: string | null;
    position: number | null;
    createdAt: Date | null;
  }[];
  _count: { media: number };
}

export function IntakeCard({ intake, showClient = true }: { intake: IntakeCardData; showClient?: boolean }) {
  const count = intake._count.media;
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {showClient ? (
              <Link href={intake.client ? `/clients/${intake.client.clientId}?tab=content` : "#"} className="block truncate font-medium hover:underline">
                {intake.client?.clientName ?? "Cliente desconocido"}
              </Link>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Images className="size-3.5" />
                {count}
                {intake.expectedCount && intake.expectedCount !== count ? ` de ${intake.expectedCount}` : ""} archivo(s)
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" /> {formatDateTime(intake.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StatusBadge status={intake.status} />
            <IntakeActions intakeId={intake.intakeId} description={intake.description} />
          </div>
        </div>

        <Link href={`/content/${intake.intakeId}`} className="grid grid-cols-4 gap-2">
          {intake.media.slice(0, 4).map((m, i) => (
            <div key={m.mediaId} className="relative">
              <MediaThumb
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
              {i === 3 && count > 4 ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 text-sm font-semibold text-white">
                  +{count - 4}
                </span>
              ) : null}
            </div>
          ))}
          {intake.media.length === 0 ? (
            <div className="col-span-4 rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Sin archivos registrados</div>
          ) : null}
        </Link>

        <p className="line-clamp-3 text-sm text-muted-foreground">
          {intake.description || <span className="italic">Sin descripción</span>}
        </p>
      </CardContent>
    </Card>
  );
}
