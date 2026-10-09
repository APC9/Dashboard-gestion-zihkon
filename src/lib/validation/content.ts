import { z } from "zod";
import { paginationSchema } from "./common";

export const contentDescriptionSchema = z.object({
  description: z.string().trim().max(4000, "Máximo 4000 caracteres"),
});

export const contentGenerateSchema = z.object({
  mode: z.enum(["generate", "send_to_ai", "regenerate"]).default("generate"),
  instructions: z.string().trim().max(4000).optional(),
});

export const contentListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "pending", "ready", "error", "done"]).default("all"),
  clientId: z.string().uuid().optional(),
});
export type ContentListQuery = z.infer<typeof contentListQuerySchema>;

export const auditListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export const auditGenerateSchema = z.object({
  nombre_negocio: z.string().trim().min(2, "Nombre obligatorio").max(200),
  direccion: z.string().trim().min(3, "Dirección obligatoria").max(300),
  email: z.string().trim().email("Email no válido"),
});
export type AuditGenerateValues = z.input<typeof auditGenerateSchema>;

export const automationAdminSchema = z.object({
  phoneE164: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s().-]/g, ""))
    .pipe(z.string().regex(/^\+?[1-9]\d{6,14}$/, "Formato E.164, p. ej. +34600111222")),
  active: z.boolean().default(true),
});

export const executeWorkflowSchema = z.object({
  resourceId: z.union([z.string().max(100), z.number()]).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
