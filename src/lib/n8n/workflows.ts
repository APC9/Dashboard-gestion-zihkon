import { z } from "zod";

/**
 * Catálogo de workflows de n8n que el panel puede lanzar.
 *
 * Cada entrada define:
 *  - resource: qué tipo de recurso recibe (se verifica en BD y permisos antes de llamar).
 *  - path: ruta del webhook relativa a N8N_WEBHOOK_BASE_URL, sobreescribible con `envPath`.
 *  - data: esquema Zod de los datos adicionales que acepta.
 *
 * Este archivo NO es server-only porque la UI usa los nombres/descripciones.
 * Las URLs reales se resuelven solo en servidor (lib/n8n/client.ts).
 */

export type WorkflowResource = "client" | "website" | "content" | "review" | "gbp_profile" | "audit" | "none";
export type WorkflowCategory = "content" | "website" | "gbp" | "audit" | "system";

export interface WorkflowDefinition<S extends z.ZodType = z.ZodType> {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  resource: WorkflowResource;
  envPath: string;
  defaultPath: string;
  data: S;
  /** Se puede lanzar manualmente desde la página Automatizaciones. */
  manual: boolean;
  /** Timeout propio en ms (por defecto N8N_WEBHOOK_TIMEOUT_MS). */
  timeoutMs?: number;
}

function defineWorkflow<S extends z.ZodType>(def: WorkflowDefinition<S>) {
  return def;
}

const empty = z.object({}).strict();

export const WORKFLOWS = {
  contentGeneration: defineWorkflow({
    id: "content-generation",
    name: "Generación de contenido",
    description: "Genera publicaciones a partir del contenido recibido por WhatsApp.",
    category: "content",
    resource: "content",
    envPath: "N8N_PATH_CONTENT_GENERATION",
    defaultPath: "zihkon/content/generate",
    data: z
      .object({
        mode: z.enum(["generate", "send_to_ai", "regenerate"]).default("generate"),
        instructions: z.string().trim().max(4000).optional(),
      })
      .strict(),
    manual: false,
  }),
  websiteChange: defineWorkflow({
    id: "website-change",
    name: "Modificación de web con IA",
    description: "Solicita un cambio en el repositorio de la web mediante IA.",
    category: "website",
    resource: "website",
    envPath: "N8N_PATH_WEBSITE_CHANGE",
    defaultPath: "zihkon/website/change",
    data: z
      .object({
        instructions: z.string().trim().min(10, "Describe el cambio con al menos 10 caracteres").max(4000),
      })
      .strict(),
    manual: false,
  }),
  websitePreview: defineWorkflow({
    id: "website-preview",
    name: "Crear preview de web",
    description: "Genera un deploy de preview en Netlify.",
    category: "website",
    resource: "website",
    envPath: "N8N_PATH_WEBSITE_PREVIEW",
    defaultPath: "zihkon/website/preview",
    data: empty,
    manual: false,
  }),
  websitePublish: defineWorkflow({
    id: "website-publish",
    name: "Publicar web",
    description: "Publica los cambios de la web en producción.",
    category: "website",
    resource: "website",
    envPath: "N8N_PATH_WEBSITE_PUBLISH",
    defaultPath: "zihkon/website/publish",
    data: empty,
    manual: false,
  }),
  gbpReviewApproval: defineWorkflow({
    id: "gbp-review-approval",
    name: "Aprobación de respuesta GBP",
    description: "Notifica a n8n que una respuesta ha sido aprobada.",
    category: "gbp",
    resource: "review",
    envPath: "N8N_PATH_GBP_REVIEW_APPROVAL",
    defaultPath: "zihkon/gbp/review-approved",
    data: z.object({ scheduled_publish_date: z.string().datetime().nullable().optional() }).strict(),
    manual: false,
  }),
  gbpReviewPublication: defineWorkflow({
    id: "gbp-review-publication",
    name: "Publicar respuesta en Google",
    description: "Publica la respuesta aprobada en Google Business Profile.",
    category: "gbp",
    resource: "review",
    envPath: "N8N_PATH_GBP_REVIEW_PUBLISH",
    defaultPath: "zihkon/gbp/review-publish",
    data: empty,
    manual: false,
  }),
  gbpReviewRegenerate: defineWorkflow({
    id: "gbp-review-regenerate",
    name: "Regenerar respuesta GBP",
    description: "Pide a la IA una nueva respuesta para la reseña.",
    category: "gbp",
    resource: "review",
    envPath: "N8N_PATH_GBP_REVIEW_REGENERATE",
    defaultPath: "zihkon/gbp/review-regenerate",
    data: z.object({ instructions: z.string().trim().max(2000).optional() }).strict(),
    manual: false,
  }),
  gbpSyncReviews: defineWorkflow({
    id: "gbp-sync-reviews",
    name: "Sincronizar reseñas GBP",
    description: "Descarga las últimas reseñas de un perfil de Google Business.",
    category: "gbp",
    resource: "gbp_profile",
    envPath: "N8N_PATH_GBP_SYNC_REVIEWS",
    defaultPath: "zihkon/gbp/sync-reviews",
    data: empty,
    manual: true,
  }),
  gbpListAccounts: defineWorkflow({
    id: "gbp-list-accounts",
    name: "Consultar cuentas y fichas de Google",
    description: "Lista las cuentas de Google Business Profile y sus fichas (account_id y location_id).",
    category: "gbp",
    resource: "none",
    envPath: "N8N_PATH_GBP_LIST_ACCOUNTS",
    defaultPath: "zihkon/gbp/accounts",
    data: empty,
    manual: false,
    // Recorre todas las cuentas y fichas en la API de Google: tarda más que el resto.
    timeoutMs: 30_000,
  }),
  auditGeneration: defineWorkflow({
    id: "audit-generation",
    name: "Generar auditoría local",
    description: "Genera una auditoría de presencia local para un negocio.",
    category: "audit",
    resource: "none",
    envPath: "N8N_PATH_AUDIT_GENERATION",
    defaultPath: "zihkon/audit/generate",
    data: z
      .object({
        nombre_negocio: z.string().trim().min(2).max(200),
        direccion: z.string().trim().min(3).max(300),
        email: z.string().trim().email(),
      })
      .strict(),
    manual: true,
  }),
  clientOnboarding: defineWorkflow({
    id: "client-onboarding",
    name: "Onboarding de cliente",
    description: "Crea carpeta de Drive, hoja de cálculo y mensajes de bienvenida.",
    category: "system",
    resource: "client",
    envPath: "N8N_PATH_CLIENT_ONBOARDING",
    defaultPath: "zihkon/client/onboarding",
    data: empty,
    manual: true,
  }),
} as const;

export type WorkflowKey = keyof typeof WORKFLOWS;
export type WorkflowId = (typeof WORKFLOWS)[WorkflowKey]["id"];

export function findWorkflow(id: string): (typeof WORKFLOWS)[WorkflowKey] | undefined {
  return Object.values(WORKFLOWS).find((w) => w.id === id);
}

/** Versión serializable para enviar al cliente (sin esquemas ni rutas). */
export function publicWorkflowList() {
  return Object.values(WORKFLOWS).map(({ id, name, description, category, resource, manual }) => ({
    id,
    name,
    description,
    category,
    resource,
    manual,
  }));
}
export type PublicWorkflow = ReturnType<typeof publicWorkflowList>[number];
