import "server-only";
import { ForbiddenError } from "@/lib/api/errors";
import type { Actor } from "./types";

/**
 * Capa de autorización por cliente. TODA lectura/escritura de datos de un
 * cliente pasa por aquí, aunque hoy solo existan ADMIN. Cuando se habilite
 * el rol CLIENT, estas funciones garantizan el aislamiento entre clientes.
 */

export function isAdmin(actor: Actor) {
  return actor.role === "ADMIN";
}

/** ¿Puede el actor acceder al client_id (UUID) indicado? */
export function canAccessClient(actor: Actor, clientId: string | null | undefined): boolean {
  if (isAdmin(actor)) return true;
  return !!clientId && actor.clientId === clientId;
}

export function assertClientAccess(actor: Actor, clientId: string | null | undefined) {
  if (!canAccessClient(actor, clientId)) throw new ForbiddenError();
}

/** ¿Puede el actor acceder al perfil GBP (INTEGER) indicado? */
export function canAccessGbpClient(actor: Actor, gbpClientId: number | null | undefined): boolean {
  if (isAdmin(actor)) return true;
  return gbpClientId != null && actor.gbpClientIds.includes(gbpClientId);
}

export function assertGbpAccess(actor: Actor, gbpClientId: number | null | undefined) {
  if (!canAccessGbpClient(actor, gbpClientId)) throw new ForbiddenError();
}

/**
 * Filtros Prisma de ámbito. Un ADMIN no tiene filtro; un CLIENT queda
 * restringido a sus propios IDs (o a nada si no tiene ninguno).
 */
export function clientScope(actor: Actor): { clientId?: string } {
  if (isAdmin(actor)) return {};
  return { clientId: actor.clientId ?? "00000000-0000-0000-0000-000000000000" };
}

export function gbpScope(actor: Actor): { id?: { in: number[] } } {
  if (isAdmin(actor)) return {};
  return { id: { in: actor.gbpClientIds } };
}

export function gbpReviewScope(actor: Actor): { clientId?: { in: number[] } } {
  if (isAdmin(actor)) return {};
  return { clientId: { in: actor.gbpClientIds } };
}

/** Recursos sin client_id (auditorías, admins de automatización, errores globales): solo ADMIN. */
export function assertAdmin(actor: Actor) {
  if (!isAdmin(actor)) throw new ForbiddenError();
}
