import { z } from "zod";
import { optionalPattern, optionalText, paginationSchema, phoneField, timezoneField } from "./common";

const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export const clientFormSchema = z.object({
  clientName: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  whatsappE164: phoneField,
  driveFolderId: optionalPattern(DRIVE_ID_RE, "ID de carpeta de Drive no válido", 200),
  googleSheetId: optionalPattern(DRIVE_ID_RE, "ID de Google Sheet no válido", 200),
  googleSheetTab: optionalText(100),
  timezone: timezoneField,
  active: z.boolean(),
});
export type ClientFormValues = z.input<typeof clientFormSchema>;

export const clientUpdateSchema = clientFormSchema.partial();

export const clientStatusSchema = z.object({ active: z.boolean() });

export const clientListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  web: z.enum(["all", "yes", "no"]).default("all"),
  gbp: z.enum(["all", "yes", "no"]).default("all"),
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
