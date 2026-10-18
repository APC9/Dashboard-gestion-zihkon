import { AlertTriangle, Quote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewEditor } from "@/components/gbp/review-editor";
import { PageHeader } from "@/components/shared/page-header";
import { RatingStars } from "@/components/shared/rating-stars";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundError } from "@/lib/api/errors";
import { requireAdminPage } from "@/lib/auth/session";
import { getReview } from "@/lib/data/gbp";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Reseña" };

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminPage();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const review = await getReview(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  const timeline = [
    { label: "Fecha de la reseña", value: review.reviewDate },
    { label: "Registrada", value: review.createdDate },
    { label: "Enviada al cliente para aprobar", value: review.approvalSentAt },
    { label: `Último recordatorio (${review.reminderCount} de 7)`, value: review.lastReminderAt },
    { label: "Aprobada", value: review.approvedDate },
    { label: "Publicación programada", value: review.scheduledPublishDate },
    { label: "Publicada", value: review.publishedDate },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/gbp/reviews", label: "Reseñas" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Reseña de {review.reviewerName ?? "Anónimo"} <StatusBadge status={review.status} />
          </span>
        }
        description={
          <>
            {review.gbpClient ? (
              <Link href={`/gbp/profiles/${review.gbpClient.id}`} className="hover:underline">
                {review.gbpClient.client.clientName ?? "Perfil sin nombre"}
              </Link>
            ) : (
              "Negocio desconocido"
            )}{" "}
            · Review ID <span className="font-mono">{review.reviewId ?? "—"}</span>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                Reseña original <RatingStars rating={review.rating} className="[&_svg]:size-4" />
              </CardTitle>
              <CardDescription>{formatDateTime(review.reviewDate)}</CardDescription>
            </CardHeader>
            <CardContent>
              <blockquote className="relative rounded-lg bg-muted/50 p-4 pl-10 text-sm leading-relaxed whitespace-pre-wrap">
                <Quote className="absolute top-4 left-3 size-4 text-muted-foreground" />
                {review.reviewText || <em className="text-muted-foreground">El autor no escribió texto, solo puntuación.</em>}
              </blockquote>
            </CardContent>
          </Card>

          {review.existingResponse ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Respuesta existente en Google</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="rounded-lg border p-4 text-sm whitespace-pre-wrap">{review.existingResponse}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Respuesta generada por IA</CardTitle>
              <CardDescription>Revísala y edítala antes de aprobar. La publicación la realiza n8n.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewEditor reviewId={review.id} status={review.status} generatedResponse={review.generatedResponse} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cronología</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                {timeline.map((t) => (
                  <div key={t.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t.label}</dt>
                    <dd className="text-right tabular-nums">{formatDateTime(t.value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          {review.errorDetails || review.errors.length ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="size-4" /> Errores
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {review.errorDetails ? <p className="break-words whitespace-pre-wrap">{review.errorDetails}</p> : null}
                {review.errors.map((e) => (
                  <div key={e.id} className="rounded-lg border p-2.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase">{e.stage ?? "Error"} · {formatDateTime(e.createdAt)}</p>
                    <p className="mt-1 break-words">{e.errorMessage}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
