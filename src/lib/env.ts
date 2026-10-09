import "server-only";
import { z } from "zod";

/**
 * Variables de entorno del SERVIDOR. Nunca importar desde componentes cliente
 * (`server-only` lo impide en build). Ningún secreto usa el prefijo NEXT_PUBLIC_.
 *
 * Se validan de forma perezosa para que `next build` funcione sin secretos.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET debe tener al menos 32 caracteres"),
  NEXTAUTH_URL: z.string().url().optional(),

  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  ADMIN_NAME: z.string().default("Administrador Zihkon"),

  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().min(16).optional(),
  N8N_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // Opcional: API REST de n8n para leer ejecuciones (Automatizaciones).
  N8N_API_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

function emptyToUndefined(source: NodeJS.ProcessEnv) {
  return Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
}

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(emptyToUndefined(process.env));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración de entorno inválida:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Estado de configuración sin exponer valores (para la página Configuración). */
export function envStatus() {
  const e = emptyToUndefined(process.env);
  const has = (k: string) => typeof e[k] === "string" && (e[k] as string).length > 0;
  return {
    database: has("DATABASE_URL"),
    authSecret: has("NEXTAUTH_SECRET"),
    authUrl: has("NEXTAUTH_URL"),
    admin: has("ADMIN_EMAIL") && has("ADMIN_PASSWORD_HASH"),
    n8nWebhooks: has("N8N_WEBHOOK_BASE_URL") && has("N8N_WEBHOOK_SECRET"),
    n8nApi: has("N8N_API_URL") && has("N8N_API_KEY"),
    appUrl: has("NEXT_PUBLIC_APP_URL"),
  };
}
