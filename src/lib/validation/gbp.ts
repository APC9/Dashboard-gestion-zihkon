import { z } from "zod";
import { optionalEmail, optionalText, paginationSchema } from "./common";
import { REVIEW_STATUSES } from "@/lib/status";

export const GBP_RESPONSE_MODES = ["manual", "automatic"] as const;

/** Campos de configuración del perfil GBP (sin cliente ni estado). Ajustados a las restricciones reales de `gbp_clients`. */
export const gbpProfileFields = {
  locationId: z.string().trim().min(1, "El Location ID es obligatorio").max(200),
  accountId: z.string().trim().min(1, "El Account ID es obligatorio").max(200),
  businessType: optionalText(100),
  responseTone: optionalText(100),
  preferredLanguage: optionalText(50),
  responseMode: z.enum(GBP_RESPONSE_MODES, { error: "Modo no válido" }),
  customAiInstructions: optionalText(4000),
  // Columna NOT NULL con DEFAULT 15: vacío => 15.
  delayMinutes: z
    .number({ error: "Introduce un número" })
    .int()
    .min(0)
    .max(10080)
    .nullable()
    .transform((v) => v ?? 15),
  contactEmail: optionalEmail,
};

/**
 * El nombre y el WhatsApp del negocio no se guardan en gbp_clients: se leen
 * siempre del cliente enlazado (gbp_clients.client_id → clients).
 */
export const gbpProfileFormSchema = z.object({
  clientId: z.string({ error: "Selecciona un cliente" }).uuid("Selecciona un cliente"),
  ...gbpProfileFields,
  active: z.boolean(),
});
export type GbpProfileFormValues = z.input<typeof gbpProfileFormSchema>;
export type GbpProfileInput = z.output<typeof gbpProfileFormSchema>;

/** El cliente de un perfil no se cambia al editar. */
export const gbpProfileUpdateSchema = gbpProfileFormSchema.omit({ clientId: true }).partial();
export type GbpProfileUpdateInput = z.output<typeof gbpProfileUpdateSchema>;

/** Google limita las respuestas a 4096 caracteres. */
const responseText = z.string().trim().max(4096, "Máximo 4096 caracteres");

export const reviewUpdateSchema = z.object({
  generatedResponse: responseText.optional(),
});

export const reviewApproveSchema = z.object({
  generatedResponse: responseText.min(1, "La respuesta no puede estar vacía").optional(),
  scheduledPublishDate: z.string().datetime({ offset: true }).nullable().optional(),
});

export const reviewRejectSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export const reviewScheduleSchema = z.object({
  scheduledPublishDate: z
    .string()
    .datetime({ offset: true, message: "Fecha no válida" })
    .refine((v) => Date.parse(v) > Date.now(), "La fecha debe ser futura"),
});

export const reviewRegenerateSchema = z.object({
  instructions: z.string().trim().max(2000).optional(),
});

export const reviewListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "pending", ...REVIEW_STATUSES]).default("all"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  gbpClientId: z.string().uuid().optional(),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;

// ---------------------------------------------------------------------------
// Respuesta del workflow gbp-list-accounts (n8n)
// ---------------------------------------------------------------------------

/** Una cuenta sin fichas llega con location_id, title y address a null. */
export const googleAccountItemSchema = z.object({
  account_id: z.string().min(1),
  account_name: z.string(),
  location_id: z.string().min(1).nullable(),
  title: z.string().nullable(),
  address: z.string().nullable(),
});
export type GoogleAccountItem = z.infer<typeof googleAccountItemSchema>;

export const googleAccountsSuccessSchema = z.object({
  ok: z.literal(true),
  count: z.number().int().nonnegative(),
  items: z.array(googleAccountItemSchema),
});

export const googleAccountsErrorSchema = z.object({ ok: z.literal(false), error: z.string().min(1) });
