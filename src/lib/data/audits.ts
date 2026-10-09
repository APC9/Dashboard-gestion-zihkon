import "server-only";
import { NotFoundError } from "@/lib/api/errors";
import { assertAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AuditListQuery } from "@/lib/validation/content";
import { contains, paginate, paginated } from "./helpers";

/**
 * Las auditorías no tienen client_id (son leads/prospección), así que solo
 * el ADMIN puede verlas. Para el portal de cliente habría que vincularlas
 * explícitamente a un client_id.
 */

export async function listAudits(actor: Actor, query: AuditListQuery) {
  assertAdmin(actor);
  const and: Prisma.AuditoriaLocalWhereInput[] = [];
  if (query.q) {
    and.push({
      OR: [
        { nombreNegocio: contains(query.q) },
        { email: contains(query.q) },
        { emailNormalizado: contains(query.q) },
        { direccion: contains(query.q) },
        { negocioClave: contains(query.q) },
      ],
    });
  }
  if (query.from) and.push({ createdAt: { gte: new Date(`${query.from}T00:00:00`) } });
  if (query.to) and.push({ createdAt: { lte: new Date(`${query.to}T23:59:59`) } });
  const where: Prisma.AuditoriaLocalWhereInput = and.length ? { AND: and } : {};

  const [items, total] = await Promise.all([
    prisma.auditoriaLocal.findMany({
      where,
      // No se cargan los JSONB grandes en el listado.
      select: {
        id: true,
        nombreNegocio: true,
        email: true,
        direccion: true,
        pdfUrl: true,
        driveFileId: true,
        createdAt: true,
        negocioClave: true,
      },
      orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      ...paginate(query.page, query.pageSize),
    }),
    prisma.auditoriaLocal.count({ where }),
  ]);
  return paginated(
    items.map((a) => ({ ...a, id: a.id.toString() })),
    total,
    query.page,
    query.pageSize,
  );
}

export async function getAudit(actor: Actor, id: string) {
  assertAdmin(actor);
  let bigId: bigint;
  try {
    bigId = BigInt(id);
  } catch {
    throw new NotFoundError("Auditoría no encontrada");
  }
  const audit = await prisma.auditoriaLocal.findUnique({ where: { id: bigId } });
  if (!audit) throw new NotFoundError("Auditoría no encontrada");
  return { ...audit, id: audit.id.toString() };
}

/**
 * Auditorías posiblemente relacionadas con un cliente (por nombre de negocio).
 * Es una coincidencia orientativa: auditorias_locales no tiene client_id.
 */
export async function findAuditsForClient(actor: Actor, clientName: string | null) {
  assertAdmin(actor);
  const name = clientName?.trim();
  if (!name || name.length < 3) return [];
  const audits = await prisma.auditoriaLocal.findMany({
    where: { OR: [{ nombreNegocio: contains(name) }, { negocioClave: contains(name.toLowerCase().replace(/\s+/g, "-")) }] },
    select: { id: true, nombreNegocio: true, email: true, direccion: true, pdfUrl: true, createdAt: true },
    orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }],
    take: 20,
  });
  return audits.map((a) => ({ ...a, id: a.id.toString() }));
}
