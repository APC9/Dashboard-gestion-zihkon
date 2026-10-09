import "server-only";
import { clientScope, gbpReviewScope, gbpScope, isAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { contains, digitsOnly } from "./helpers";

export type SearchGroup = "Clientes" | "Webs" | "Google Business" | "Reseñas" | "Auditorías";

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string | null;
  href: string;
}

/**
 * Buscador global: nombre de cliente, WhatsApp, email, negocio, Location ID,
 * URL, repositorio GitHub y Review ID. Cada consulta respeta el ámbito del actor.
 */
export async function globalSearch(actor: Actor, q: string, perGroup = 5): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = digitsOnly(term);
  const phoneFilter = digits.length >= 4 ? [{ whatsappE164: { contains: digits } }] : [];

  const [clients, websites, profiles, reviews, audits] = await Promise.all([
    prisma.client.findMany({
      where: { ...clientScope(actor), OR: [{ clientName: contains(term) }, { whatsappE164: contains(term) }, ...phoneFilter] },
      select: { clientId: true, clientName: true, whatsappE164: true },
      take: perGroup,
    }),
    prisma.clientWebsite.findMany({
      where: {
        ...clientScope(actor),
        OR: [{ websiteUrl: contains(term) }, { githubRepository: contains(term) }, { githubOwner: contains(term) }],
      },
      select: { websiteId: true, clientId: true, websiteUrl: true, githubOwner: true, githubRepository: true, client: { select: { clientName: true } } },
      take: perGroup,
    }),
    prisma.gbpClient.findMany({
      where: {
        ...gbpScope(actor),
        OR: [
          { businessName: contains(term) },
          { locationId: contains(term) },
          { contactEmail: contains(term) },
          { notificationEmail: contains(term) },
          ...phoneFilter,
        ],
      },
      select: { id: true, businessName: true, locationId: true },
      take: perGroup,
    }),
    prisma.gbpReviewActivity.findMany({
      where: { ...gbpReviewScope(actor), OR: [{ reviewId: contains(term) }, { reviewerName: contains(term) }] },
      select: { id: true, reviewId: true, reviewerName: true, gbpClient: { select: { businessName: true } } },
      take: perGroup,
    }),
    isAdmin(actor)
      ? prisma.auditoriaLocal.findMany({
          where: { OR: [{ nombreNegocio: contains(term) }, { email: contains(term) }, { direccion: contains(term) }] },
          select: { id: true, nombreNegocio: true, email: true },
          take: perGroup,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...clients.map((c) => ({
      id: `c-${c.clientId}`,
      group: "Clientes" as const,
      title: c.clientName ?? "Sin nombre",
      subtitle: c.whatsappE164,
      href: `/clients/${c.clientId}`,
    })),
    ...websites.map((w) => ({
      id: `w-${w.websiteId}`,
      group: "Webs" as const,
      title: w.websiteUrl ?? `${w.githubOwner}/${w.githubRepository}`,
      subtitle: [w.client?.clientName, w.githubRepository && `${w.githubOwner}/${w.githubRepository}`].filter(Boolean).join(" · "),
      href: `/clients/${w.clientId}?tab=web`,
    })),
    ...profiles.map((p) => ({
      id: `g-${p.id}`,
      group: "Google Business" as const,
      title: p.businessName ?? "Sin nombre",
      subtitle: p.locationId,
      href: `/gbp/profiles/${p.id}`,
    })),
    ...reviews.map((r) => ({
      id: `r-${r.id}`,
      group: "Reseñas" as const,
      title: `${r.reviewerName ?? "Anónimo"} · ${r.gbpClient?.businessName ?? ""}`,
      subtitle: r.reviewId,
      href: `/gbp/reviews/${r.id}`,
    })),
    ...audits.map((a) => ({
      id: `a-${a.id}`,
      group: "Auditorías" as const,
      title: a.nombreNegocio ?? "Sin nombre",
      subtitle: a.email,
      href: `/audits/${a.id}`,
    })),
  ];
}
