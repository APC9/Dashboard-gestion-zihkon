import { z } from "zod";
import { optionalText, paginationSchema, requiredPhoneField, timezoneField } from "./common";
import { gbpProfileFields } from "./gbp";

const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export const clientFormSchema = z.object({
  clientName: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  // En la BD estas columnas son NOT NULL: no se pueden dejar vacías.
  whatsappE164: requiredPhoneField,
  driveFolderId: z.string().trim().regex(DRIVE_ID_RE, "ID de carpeta de Drive obligatorio o no válido"),
  googleSheetId: z.string().trim().regex(DRIVE_ID_RE, "ID de Google Sheet obligatorio o no válido"),
  // Vacío => valor por defecto de la columna en la BD.
  googleSheetTab: optionalText(100).transform((v) => v || "Mtr_plantilla_calendario"),
  timezone: timezoneField.transform((v) => v || "Europe/Madrid"),
  active: z.boolean(),
});
export type ClientFormValues = z.input<typeof clientFormSchema>;

/**
 * Alta de cliente con perfil de Google Business opcional. El perfil queda
 * enlazado al cliente (client_id) y toma de él su nombre, WhatsApp y estado.
 */
export const clientCreateSchema = clientFormSchema.extend({
  gbp: z
    .object(gbpProfileFields)
    .nullable()
    .optional(),
});
export type ClientCreateValues = z.input<typeof clientCreateSchema>;
export type ClientCreateInput = z.output<typeof clientCreateSchema>;

export const clientUpdateSchema = clientFormSchema.partial();

export const clientStatusSchema = z.object({ active: z.boolean() });

export const clientListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  web: z.enum(["all", "yes", "no"]).default("all"),
  gbp: z.enum(["all", "yes", "no"]).default("all"),
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
