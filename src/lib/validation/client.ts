import { z } from "zod";
import { optionalEmail, optionalPattern, paginationSchema, requiredPhoneField, timezoneField } from "./common";
import { gbpProfileFields } from "./gbp";

/** Código de referido: ZK + 5 caracteres (lo genera la BD). */
export const REFERRAL_CODE_RE = /^ZK[0-9A-Z]{5}$/;
/** blogId de Metricool: solo cifras. */
const METRICOOL_BLOG_ID_RE = /^\d{3,15}$/;

export const clientFormSchema = z.object({
  clientName: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  // En la BD esta columna es NOT NULL: no se puede dejar vacía.
  whatsappE164: requiredPhoneField,
  email: optionalEmail,
  // Marca del cliente en Metricool (las publicaciones se crean en ella). Opcional hasta que se cree la marca.
  metricoolBlogId: optionalPattern(METRICOOL_BLOG_ID_RE, "El blogId de Metricool son solo números, p. ej. 5362957", 15),
  timezone: timezoneField.transform((v) => v || "Europe/Madrid"),
  active: z.boolean(),
});
export type ClientFormValues = z.input<typeof clientFormSchema>;

/**
 * Alta de cliente con perfil de Google Business opcional. El perfil queda
 * enlazado al cliente (client_id) y toma de él su nombre, WhatsApp y estado.
 */
export const clientCreateSchema = clientFormSchema.extend({
  // En el alta pueden faltar (p. ej. altas por API): vacío. En la edición NO hay valor por defecto,
  // para que un PATCH parcial no borre el email ni la marca de Metricool.
  email: clientFormSchema.shape.email.default(""),
  metricoolBlogId: clientFormSchema.shape.metricoolBlogId.default(""),
  gbp: z
    .object(gbpProfileFields)
    .nullable()
    .optional(),
  // Código de quien le ha recomendado (opcional). Sin distinguir mayúsculas.
  referralCode: optionalPattern(/^zk[0-9a-z]{5}$/i, "Código no válido: ZK seguido de 5 letras o números, p. ej. ZK4UPR7", 7)
    .transform((v) => v.toUpperCase())
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
