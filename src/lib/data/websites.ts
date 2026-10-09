import "server-only";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { assertClientAccess, clientScope } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { emptyToNull } from "@/lib/validation/common";
import { getClient } from "./clients";
import { contains } from "./helpers";

export async function listWebsites(actor: Actor, opts: { q?: string; status?: "all" | "active" | "inactive" } = {}) {
  const where: Prisma.ClientWebsiteWhereInput = { ...clientScope(actor) };
  if (opts.q) {
    where.OR = [
      { websiteUrl: contains(opts.q) },
      { githubRepository: contains(opts.q) },
      { githubOwner: contains(opts.q) },
      { netlifySiteId: contains(opts.q) },
      { client: { clientName: contains(opts.q) } },
    ];
  }
  if (opts.status === "active") where.active = true;
  if (opts.status === "inactive") where.NOT = { active: true };
  return prisma.clientWebsite.findMany({
    where,
    include: { client: { select: { clientId: true, clientName: true, active: true } } },
    orderBy: [{ updatedAt: { sort: "desc", nulls: "last" } }],
  });
}

export async function getClientWebsites(actor: Actor, clientId: string) {
  await getClient(actor, clientId);
  return prisma.clientWebsite.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
}

type WebsiteInput = {
  websiteId?: string;
  githubOwner: string;
  githubRepository: string;
  defaultBranch: string;
  netlifySiteId: string;
  websiteUrl: string;
  previewModeEnabled: boolean;
  active: boolean;
};

/** Crea o actualiza la web de un cliente. Verifica que la web pertenece al cliente. */
export async function upsertClientWebsite(actor: Actor, clientId: string, input: WebsiteInput) {
  await getClient(actor, clientId);
  const { websiteId, ...rest } = input;
  const data = emptyToNull(rest);

  if (websiteId) {
    const existing = await prisma.clientWebsite.findUnique({ where: { websiteId } });
    if (!existing || existing.clientId !== clientId) throw new NotFoundError("Web no encontrada para este cliente");
    return prisma.clientWebsite.update({ where: { websiteId }, data });
  }
  await assertNoDuplicateWebsite(clientId, data.githubOwner, data.githubRepository, data.websiteUrl);
  return prisma.clientWebsite.create({ data: { ...data, clientId } });
}

/** Una web es la misma si coincide el repositorio (owner opcional) o la URL, dentro del mismo cliente. */
async function assertNoDuplicateWebsite(
  clientId: string,
  owner: string | null,
  repo: string | null,
  url: string | null,
) {
  const or: Prisma.ClientWebsiteWhereInput[] = [];
  if (repo) {
    or.push({
      githubRepository: { equals: repo, mode: "insensitive" },
      ...(owner ? { OR: [{ githubOwner: { equals: owner, mode: "insensitive" } }, { githubOwner: null }, { githubOwner: "" }] } : {}),
    });
  }
  if (url) {
    const bare = url.replace(/\/+$/, "");
    or.push({ websiteUrl: { equals: bare, mode: "insensitive" } }, { websiteUrl: { equals: `${bare}/`, mode: "insensitive" } });
  }
  if (!or.length) return;
  const existing = await prisma.clientWebsite.findFirst({ where: { clientId, OR: or }, select: { websiteId: true } });
  if (existing) throw new ConflictError("Este cliente ya tiene esa web registrada. Edítala en lugar de crear otra.");
}

export async function getWebsite(actor: Actor, websiteId: string) {
  const site = await prisma.clientWebsite.findUnique({ where: { websiteId } });
  if (!site) throw new NotFoundError("Web no encontrada");
  assertClientAccess(actor, site.clientId);
  return site;
}
