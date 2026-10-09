import { z } from "zod";
import { optionalEmail, optionalText, paginationSchema, phoneField } from "./common";
import { REVIEW_STATUSES } from "@/lib/status";

export const gbpProfileFormSchema = z.object({
  businessName: z.string().trim().min(2, "El nombre del negocio es obligatorio").max(200),
  locationId: optionalText(200),
  accountId: optionalText(200),
  businessType: optionalText(100),
  responseTone: optionalText(100),
  preferredLanguage: optionalText(20),
  responseMode: optionalText(50),
  customAiInstructions: optionalText(4000),
  notificationEmail: optionalEmail,
  telegramChatId: optionalText(50),
  whatsappE164: phoneField,
  delayMinutes: z.number({ error: "Introduce un número" }).int().min(0).max(10080).nullable(),
  contactEmail: optionalEmail,
  active: z.boolean(),
});
export type GbpProfileFormValues = z.input<typeof gbpProfileFormSchema>;

export const gbpProfileUpdateSchema = gbpProfileFormSchema.partial();

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
  gbpClientId: z.coerce.number().int().positive().optional(),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
