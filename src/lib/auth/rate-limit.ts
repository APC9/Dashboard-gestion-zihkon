import "server-only";

/**
 * Limitador en memoria (por proceso) para frenar fuerza bruta en el login.
 * Suficiente para un único contenedor; con varias réplicas usar Redis.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailedAttempt(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}

type HeaderValue = string | string[] | undefined;

/**
 * IP del cliente para el límite de intentos. Se usa la ÚLTIMA entrada de
 * X-Forwarded-For: la añade el proxy de confianza (Traefik en Coolify). Las
 * anteriores las puede inventar el propio cliente, y usarlas permitiría
 * saltarse el bloqueo cambiando la cabecera en cada intento.
 */
export function clientIpFromHeaders(headers: Record<string, HeaderValue>): string {
  const pick = (v: HeaderValue) => (Array.isArray(v) ? v.join(",") : v) ?? "";
  const hops = pick(headers["x-forwarded-for"]).split(",").map((h) => h.trim()).filter(Boolean);
  return hops.at(-1) ?? (pick(headers["x-real-ip"]).trim() || "unknown");
}
