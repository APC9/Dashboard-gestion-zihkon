import "server-only";
import { recentActivity } from "@/lib/activity-log";
import { assertAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import {
  CONTENT_DONE_STATUSES,
  CONTENT_ERROR_STATUSES,
  CONTENT_READY_STATUSES,
  ratingToNumber,
  REVIEW_PENDING_STATUSES,
} from "@/lib/status";
import { statusIn } from "./helpers";

/** El dashboard global agrega datos de todos los clientes: solo ADMIN. */

export async function getDashboardStats(actor: Actor) {
  assertAdmin(actor);
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const since7 = new Date(Date.now() - 7 * 86400_000);
  const [
    activeClients,
    totalClients,
    activeWebsites,
    activeGbp,
    pendingReviews,
    pendingContent,
    recentAudits,
    gbpErrors,
    messageErrors,
  ] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.client.count(),
    prisma.clientWebsite.count({ where: { active: true } }),
    prisma.gbpClient.count({ where: { active: true } }),
    prisma.gbpReviewActivity.count({ where: { OR: statusIn(REVIEW_PENDING_STATUSES) } }),
    prisma.contentIntake.count({
      where: { NOT: { OR: [...statusIn(CONTENT_DONE_STATUSES), ...statusIn(CONTENT_ERROR_STATUSES)] } },
    }),
    prisma.auditoriaLocal.count({ where: { createdAt: { gte: since30 } } }),
    prisma.gbpAutomationError.count({ where: { createdAt: { gte: since7 } } }),
    prisma.processedMessage.count({ where: { receivedAt: { gte: since7 }, error: { not: null } } }),
  ]);
  return {
    activeClients,
    totalClients,
    activeWebsites,
    activeGbp,
    pendingReviews,
    pendingContent,
    recentAudits,
    automationErrors: gbpErrors + messageErrors,
  };
}

type Bucket = { bucket: string; total: number };
type Bucket2 = { bucket: string; a: number; b: number };

/**
 * Series para los gráficos. Los buckets se generan en SQL (generate_series)
 * para que no falten periodos sin datos. Consultas 100% parametrizadas.
 */
export async function getDashboardCharts(actor: Actor) {
  assertAdmin(actor);
  const done = [...CONTENT_READY_STATUSES, ...CONTENT_DONE_STATUSES].map((s) => s.toUpperCase());

  const [clients, content, reviews, automations] = await Promise.all([
    prisma.$queryRaw<Bucket[]>`
      SELECT to_char(b.bucket, 'YYYY-MM') AS bucket, count(c.client_id)::int AS total
      FROM generate_series(date_trunc('month', LOCALTIMESTAMP) - interval '5 months',
                           date_trunc('month', LOCALTIMESTAMP), interval '1 month') AS b(bucket)
      LEFT JOIN clients c ON date_trunc('month', c.created_at) = b.bucket
      GROUP BY b.bucket ORDER BY b.bucket`,
    prisma.$queryRaw<Bucket2[]>`
      SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
             count(i.intake_id)::int AS a,
             count(i.intake_id) FILTER (WHERE upper(i.status) = ANY(${done}))::int AS b
      FROM generate_series(date_trunc('week', LOCALTIMESTAMP) - interval '7 weeks',
                           date_trunc('week', LOCALTIMESTAMP), interval '1 week') AS b(bucket)
      LEFT JOIN content_intakes i ON date_trunc('week', i.created_at) = b.bucket
      GROUP BY b.bucket ORDER BY b.bucket`,
    prisma.$queryRaw<Bucket[]>`
      SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket, count(r.id)::int AS total
      FROM generate_series(date_trunc('week', LOCALTIMESTAMP) - interval '7 weeks',
                           date_trunc('week', LOCALTIMESTAMP), interval '1 week') AS b(bucket)
      LEFT JOIN gbp_review_activity r ON date_trunc('week', COALESCE(r.review_date, r.created_date)) = b.bucket
      GROUP BY b.bucket ORDER BY b.bucket`,
    prisma.$queryRaw<Bucket2[]>`
      WITH days AS (
        SELECT generate_series(date_trunc('day', LOCALTIMESTAMP) - interval '13 days',
                               date_trunc('day', LOCALTIMESTAMP), interval '1 day') AS bucket
      ),
      msgs AS (
        SELECT date_trunc('day', received_at) AS d,
               count(*) AS total,
               count(*) FILTER (WHERE error IS NOT NULL OR upper(status) IN ('ERROR', 'FAILED')) AS errors
        FROM processed_messages
        WHERE received_at >= date_trunc('day', LOCALTIMESTAMP) - interval '13 days'
        GROUP BY 1
      ),
      gbp AS (
        SELECT date_trunc('day', created_at) AS d, count(*) AS errors
        FROM gbp_automation_errors
        WHERE created_at >= date_trunc('day', LOCALTIMESTAMP) - interval '13 days'
        GROUP BY 1
      )
      SELECT to_char(days.bucket, 'YYYY-MM-DD') AS bucket,
             COALESCE(msgs.total, 0)::int AS a,
             (COALESCE(msgs.errors, 0) + COALESCE(gbp.errors, 0))::int AS b
      FROM days
      LEFT JOIN msgs ON msgs.d = days.bucket
      LEFT JOIN gbp ON gbp.d = days.bucket
      ORDER BY days.bucket`,
  ]);

  return {
    newClients: clients.map((r) => ({ label: r.bucket, clientes: r.total })),
    content: content.map((r) => ({ label: r.bucket, recibidos: r.a, procesados: r.b })),
    reviews: reviews.map((r) => ({ label: r.bucket, reseñas: r.total })),
    automations: automations.map((r) => ({ label: r.bucket, ejecuciones: r.a, errores: r.b })),
  };
}

export type ActivityKind = "review" | "content" | "session" | "audit" | "error" | "panel";
export interface ActivityItem {
  id: string;
  at: Date | null;
  kind: ActivityKind;
  title: string;
  href?: string;
}

export async function getRecentActivity(actor: Actor, limit = 15): Promise<ActivityItem[]> {
  assertAdmin(actor);
  const [reviews, intakes, sessions, audits, gbpErrors, msgErrors] = await Promise.all([
    prisma.gbpReviewActivity.findMany({
      orderBy: [{ createdDate: { sort: "desc", nulls: "last" } }],
      take: limit,
      include: { gbpClient: { select: { businessName: true } } },
    }),
    prisma.contentIntake.findMany({
      orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
      take: limit,
      include: { client: { select: { clientName: true } }, _count: { select: { media: true } } },
    }),
    prisma.contentSession.findMany({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: limit,
      include: { client: { select: { clientName: true } } },
    }),
    prisma.auditoriaLocal.findMany({
      orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
      take: limit,
      select: { id: true, nombreNegocio: true, createdAt: true },
    }),
    prisma.gbpAutomationError.findMany({
      orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
      take: limit,
      include: { gbpClient: { select: { businessName: true } } },
    }),
    prisma.processedMessage.findMany({
      where: { error: { not: null } },
      orderBy: [{ receivedAt: { sort: "desc", nulls: "last" } }],
      take: limit,
      include: { client: { select: { clientName: true } } },
    }),
  ]);

  const items: ActivityItem[] = [
    ...reviews.map((r) => {
      const stars = ratingToNumber(r.rating);
      return {
        id: `review-${r.id}`,
        at: r.createdDate ?? r.reviewDate,
        kind: "review" as const,
        title: `${r.gbpClient?.businessName ?? "Un negocio"} recibió una nueva reseña${stars ? ` (${stars}★)` : ""}`,
        href: `/gbp/reviews/${r.id}`,
      };
    }),
    ...intakes.map((i) => ({
      id: `intake-${i.intakeId}`,
      at: i.createdAt,
      kind: "content" as const,
      title: `${i.client?.clientName ?? "Un cliente"} envió ${i._count.media || i.expectedCount || 0} archivo(s) por WhatsApp`,
      href: `/content/${i.intakeId}`,
    })),
    ...sessions.map((s) => ({
      id: `session-${s.sessionId}`,
      at: s.completedAt,
      kind: "session" as const,
      title: `La automatización de contenido de ${s.client?.clientName ?? "un cliente"} terminó`,
      href: s.contentIntakeId ? `/content/${s.contentIntakeId}` : "/content",
    })),
    ...audits.map((a) => ({
      id: `audit-${a.id}`,
      at: a.createdAt,
      kind: "audit" as const,
      title: `La auditoría de ${a.nombreNegocio ?? "un negocio"} fue generada`,
      href: `/audits/${a.id}`,
    })),
    ...gbpErrors.map((e) => ({
      id: `gbperr-${e.id}`,
      at: e.createdAt,
      kind: "error" as const,
      title: `Error en automatización GBP${e.stage ? ` (${e.stage})` : ""}${e.gbpClient?.businessName ? ` · ${e.gbpClient.businessName}` : ""}`,
      href: "/gbp/errors",
    })),
    ...msgErrors.map((m) => ({
      id: `msgerr-${m.providerMessageId}`,
      at: m.receivedAt,
      kind: "error" as const,
      title: `Una automatización produjo un error${m.client?.clientName ? ` · ${m.client.clientName}` : ""}`,
      href: "/content?tab=errors",
    })),
    ...recentActivity(limit).map((a) => ({
      id: `panel-${a.id}`,
      at: new Date(a.at),
      kind: "panel" as const,
      title: `${a.actorEmail}: ${a.message ?? a.action}${a.clientLabel ? ` · ${a.clientLabel}` : ""}`,
    })),
  ];

  return items.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, limit);
}

/** Contadores para la campana de notificaciones del header. */
export async function getNotifications(actor: Actor) {
  if (actor.role !== "ADMIN") return { pendingReviews: 0, errors24h: 0, readyContent: 0, items: [] as ActivityItem[] };
  const since = new Date(Date.now() - 86400_000);
  const [pendingReviews, gbpErrors, msgErrors, readyContent] = await Promise.all([
    prisma.gbpReviewActivity.count({ where: { OR: statusIn(REVIEW_PENDING_STATUSES) } }),
    prisma.gbpAutomationError.count({ where: { createdAt: { gte: since } } }),
    prisma.processedMessage.count({ where: { receivedAt: { gte: since }, error: { not: null } } }),
    prisma.contentIntake.count({ where: { OR: statusIn(["READY"]) } }),
  ]);
  return { pendingReviews, errors24h: gbpErrors + msgErrors, readyContent };
}
