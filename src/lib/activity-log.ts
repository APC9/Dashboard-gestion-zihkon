import "server-only";
import type { Actor } from "@/lib/auth/types";

/**
 * Registro de acciones del panel (quién hizo qué, sobre qué cliente/recurso).
 *
 * MVP: se escribe en stdout como JSON (visible en los logs de Coolify) y se
 * guarda un buffer en memoria con las últimas acciones para la página de
 * Administración. FASE 2: activar la tabla `admin_activity_log`
 * (prisma/proposed-migrations/001_admin_activity_log.sql) y añadir un sink
 * que inserte en ella; el resto del código no cambia.
 */

export type ActivityResult = "SUCCESS" | "ERROR" | "DENIED";

export interface ActivityEntry {
  id: string;
  at: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  clientId?: string | null;
  clientLabel?: string | null;
  resourceType?: string;
  resourceId?: string | null;
  ip?: string | null;
  result: ActivityResult;
  message?: string;
  durationMs?: number;
}

export interface ActivitySink {
  write(entry: ActivityEntry): Promise<void> | void;
}

const MAX_BUFFER = 300;
const buffer: ActivityEntry[] = [];

const consoleSink: ActivitySink = {
  write(entry) {
    console.info(JSON.stringify({ type: "admin_activity", ...entry }));
  },
};

const memorySink: ActivitySink = {
  write(entry) {
    buffer.unshift(entry);
    if (buffer.length > MAX_BUFFER) buffer.length = MAX_BUFFER;
  },
};

const sinks: ActivitySink[] = [consoleSink, memorySink];

export async function logActivity(
  actor: Actor,
  input: Omit<ActivityEntry, "id" | "at" | "actorId" | "actorEmail" | "actorRole">,
) {
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    ...input,
  };
  await Promise.allSettled(sinks.map((s) => s.write(entry)));
  return entry;
}

export function recentActivity(limit = 100): ActivityEntry[] {
  return buffer.slice(0, limit);
}

export function getRequestIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

export function recentActivityForClient(clientId: string, limit = 50): ActivityEntry[] {
  return buffer.filter((e) => e.clientId === clientId).slice(0, limit);
}
