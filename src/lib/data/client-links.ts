import "server-only";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { clientScope, gbpScope } from "@/lib/auth/permissions";
import { digitsOnly } from "./helpers";

/**
 * Capa de abstracción entre los dos sistemas de clientes:
 *
 *   clients.client_id (UUID)  ←→  gbp_clients.id (INTEGER)
 *
 * En la base de datos actual NO existe ninguna relación entre ambas tablas.
 * Hasta que se apruebe la migración propuesta
 * (prisma/proposed-migrations/002_link_clients_gbp.sql), el vínculo se
 * DEDUCE en la aplicación, sin escribir nada en la BD:
 *
 *   1. mismo WhatsApp (solo dígitos)          → coincidencia fuerte
 *   2. mismo nombre normalizado               → coincidencia por nombre
 *
 * ⚠️  Un vínculo deducido sirve para mostrar información al ADMIN, pero NO
 *     debe usarse para conceder acceso a usuarios CLIENT. Para el portal de
 *     cliente es obligatorio el vínculo explícito de la migración 002.
 *
 * Si se aplica la migración, basta con cambiar `findGbpLinks` para leer
 * la columna explícita; el resto del panel no cambia.
 */

export type GbpMatch = "whatsapp" | "name";

export interface GbpLink {
  gbpClientId: number;
  businessName: string | null;
  locationId: string | null;
  active: boolean | null;
  matchedBy: GbpMatch;
}

interface LinkableClient {
  clientId: string;
  clientName: string | null;
  whatsappE164: string | null;
}

interface LinkableGbp {
  id: number;
  businessName: string | null;
  locationId: string | null;
  active: boolean | null;
  whatsappE164: string | null;
}

export function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function buildGbpLinker(profiles: LinkableGbp[]) {
  const byPhone = new Map<string, LinkableGbp[]>();
  const byName = new Map<string, LinkableGbp[]>();
  for (const p of profiles) {
    const phone = digitsOnly(p.whatsappE164);
    if (phone.length >= 7) byPhone.set(phone, [...(byPhone.get(phone) ?? []), p]);
    const name = normalizeName(p.businessName);
    if (name.length >= 3) byName.set(name, [...(byName.get(name) ?? []), p]);
  }

  return (client: LinkableClient): GbpLink[] => {
    const found = new Map<number, GbpLink>();
    for (const p of byPhone.get(digitsOnly(client.whatsappE164)) ?? []) {
      found.set(p.id, toLink(p, "whatsapp"));
    }
    for (const p of byName.get(normalizeName(client.clientName)) ?? []) {
      if (!found.has(p.id)) found.set(p.id, toLink(p, "name"));
    }
    return [...found.values()];
  };
}

function toLink(p: LinkableGbp, matchedBy: GbpMatch): GbpLink {
  return { gbpClientId: p.id, businessName: p.businessName, locationId: p.locationId, active: p.active, matchedBy };
}

export async function loadGbpLinker(actor: Actor) {
  const profiles = await prisma.gbpClient.findMany({
    where: gbpScope(actor),
    select: { id: true, businessName: true, locationId: true, active: true, whatsappE164: true },
  });
  return buildGbpLinker(profiles);
}

export async function findGbpLinks(actor: Actor, client: LinkableClient): Promise<GbpLink[]> {
  const linker = await loadGbpLinker(actor);
  return linker(client);
}

/** Inverso: posibles clientes principales para un perfil GBP. */
export async function findClientsForGbp(actor: Actor, profile: LinkableGbp) {
  const phone = digitsOnly(profile.whatsappE164);
  const candidates = await prisma.client.findMany({
    where: clientScope(actor),
    select: { clientId: true, clientName: true, whatsappE164: true },
  });
  const name = normalizeName(profile.businessName);
  return candidates
    .map((c) => {
      if (phone.length >= 7 && digitsOnly(c.whatsappE164) === phone) return { ...c, matchedBy: "whatsapp" as GbpMatch };
      if (name.length >= 3 && normalizeName(c.clientName) === name) return { ...c, matchedBy: "name" as GbpMatch };
      return null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

/** Índice inverso gbp_clients.id → cliente Zihkon deducido (para mostrar en listados). */
export async function loadClientIndexForGbp(actor: Actor) {
  const [linker, clients] = await Promise.all([
    loadGbpLinker(actor),
    prisma.client.findMany({ where: clientScope(actor), select: { clientId: true, clientName: true, whatsappE164: true } }),
  ]);
  const index = new Map<number, { clientId: string; clientName: string | null; matchedBy: GbpMatch }>();
  for (const c of clients) {
    for (const link of linker(c)) {
      const existing = index.get(link.gbpClientId);
      if (!existing || (existing.matchedBy === "name" && link.matchedBy === "whatsapp")) {
        index.set(link.gbpClientId, { clientId: c.clientId, clientName: c.clientName, matchedBy: link.matchedBy });
      }
    }
  }
  return index;
}
