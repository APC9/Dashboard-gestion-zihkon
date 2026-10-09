import Link from "next/link";
import { RatingStars } from "@/components/shared/rating-stars";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface ReviewSummaryData {
  total: number;
  pending: number;
  average: number | null;
  byStatus: Record<string, number>;
  distribution: number[];
}

export function ReviewSummary({ summary, href }: { summary: ReviewSummaryData | null; href?: string }) {
  if (!summary || summary.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de reseñas</CardTitle>
          <CardDescription>Aún no hay reseñas registradas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const max = Math.max(...summary.distribution, 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resumen de reseñas</CardTitle>
        <CardDescription>
          {summary.total} reseñas · {summary.pending} pendientes{" "}
          {href ? (
            <Link href={href} className="text-primary hover:underline">
              Ver bandeja →
            </Link>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[180px_1fr_1fr]">
        <div className="flex flex-col items-start gap-1">
          <span className="text-4xl font-semibold tabular-nums">{summary.average ? summary.average.toFixed(1) : "—"}</span>
          <RatingStars rating={summary.average ? Math.round(summary.average) : null} />
          <span className="text-xs text-muted-foreground">Valoración media</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2 text-sm">
              <span className="w-3 tabular-nums">{n}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(summary.distribution[n - 1] / max) * 100}%` }} />
              </span>
              <span className="w-6 text-right text-muted-foreground tabular-nums">{summary.distribution[n - 1]}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap content-start gap-2">
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <StatusBadge status={status} />
              <span className="text-sm tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
