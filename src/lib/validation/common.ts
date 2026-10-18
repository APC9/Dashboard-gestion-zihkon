import { z } from "zod";

/**
 * Los formularios trabajan con strings ("" = vacío). Las rutas de la API
 * convierten "" en NULL con `emptyToNull` antes de escribir en PostgreSQL.
 */

export const optionalText = (max = 255) => z.string().trim().max(max, `Máximo ${max} caracteres`);

export const optionalPattern = (re: RegExp, message: string, max = 255) =>
  optionalText(max).refine((v) => v === "" || re.test(v), message);

/** E.164 con "+" opcional (algunos registros existentes se guardaron sin "+"). */
export const PHONE_RE = /^\+?[1-9]\d{6,14}$/;
/** España (+34): siempre 9 cifras después del prefijo. */
const SPAIN_RE = /^\+?34\d{9}$/;
const spainOk = (v: string) => !/^\+?34/.test(v) || SPAIN_RE.test(v);
const SPAIN_MSG = "Un número español (+34) debe tener 9 cifras después del +34, p. ej. +34600111222";
export const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(
    z
      .string()
      .refine((v) => v === "" || PHONE_RE.test(v), "Formato E.164, p. ej. +34600111222")
      .refine((v) => v === "" || spainOk(v), SPAIN_MSG),
  );

export const requiredPhoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(PHONE_RE, "Formato E.164, p. ej. +34600111222").refine(spainOk, SPAIN_MSG));

export const optionalEmail = optionalText(254).refine(
  (v) => v === "" || z.string().email().safeParse(v).success,
  "Email no válido",
);

export const optionalUrl = optionalText(2048).refine(
  (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v),
  "URL no válida (debe empezar por https://)",
);

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timezoneField = optionalText(64).refine((v) => v === "" || isValidTimezone(v), "Zona horaria no válida");

export const uuidParam = z.object({ id: z.string().uuid("ID no válido") });
export const intParam = z.object({ id: z.coerce.number().int().positive("ID no válido") });

export function emptyToNull<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: T[K] extends string ? string | null : T[K] } {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])) as never;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
