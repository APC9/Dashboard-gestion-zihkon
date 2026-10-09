/**
 * Normalización de estados. Las tablas guardan los estados como TEXT libre
 * (escritos por n8n), así que se comparan sin distinguir mayúsculas.
 * Ajustar aquí si los workflows usan otros valores.
 */

export type StatusTone = "success" | "neutral" | "warning" | "danger" | "info" | "accent";

const TONES: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  DRAFT: "neutral",
  NEW: "info",
  APPROVED: "success",
  SCHEDULED: "accent",
  PUBLISHED: "success",
  REJECTED: "neutral",
  ERROR: "danger",
  FAILED: "danger",
  PROCESSING: "info",
  RUNNING: "info",
  COLLECTING: "info",
  OPEN: "info",
  RECEIVED: "info",
  READY: "warning",
  WAITING_DESCRIPTION: "warning",
  COMPLETED: "success",
  DONE: "success",
  PROCESSED: "success",
  SUCCESS: "success",
  CANCELLED: "neutral",
  CANCELED: "neutral",
  EXPIRED: "neutral",
  WAITING: "warning",
};

const LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING: "Pendiente",
  PENDING_APPROVAL: "Pendiente de aprobación",
  DRAFT: "Borrador",
  NEW: "Nueva",
  APPROVED: "Aprobada",
  SCHEDULED: "Programada",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
  ERROR: "Error",
  FAILED: "Fallido",
  PROCESSING: "Procesando",
  RUNNING: "En ejecución",
  COLLECTING: "Recibiendo",
  OPEN: "Abierta",
  RECEIVED: "Recibido",
  READY: "Listo",
  WAITING_DESCRIPTION: "Esperando descripción",
  COMPLETED: "Completado",
  DONE: "Hecho",
  PROCESSED: "Procesado",
  SUCCESS: "Correcto",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
  EXPIRED: "Caducado",
  WAITING: "En espera",
};

export function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function statusTone(status: string | null | undefined): StatusTone {
  return TONES[normalizeStatus(status)] ?? "neutral";
}

export function statusLabel(status: string | null | undefined): string {
  const key = normalizeStatus(status);
  if (!key) return "Sin estado";
  return LABELS[key] ?? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, " ");
}

/** Estados de reseñas GBP mostrados en la bandeja. */
export const REVIEW_STATUSES = [
  "NEW",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "REJECTED",
  "ERROR",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Reseñas que requieren intervención humana. */
export const REVIEW_PENDING_STATUSES: ReviewStatus[] = ["NEW", "DRAFT", "PENDING_APPROVAL"];

/** Estados de contenido considerados terminados (el resto cuenta como pendiente). */
export const CONTENT_DONE_STATUSES = [
  "COMPLETED",
  "DONE",
  "PUBLISHED",
  "PROCESSED",
  "CANCELLED",
  "CANCELED",
  "EXPIRED",
];
export const CONTENT_ERROR_STATUSES = ["ERROR", "FAILED"];
export const CONTENT_READY_STATUSES = ["READY", "COMPLETED", "DONE", "PROCESSED"];
export const SESSION_ACTIVE_STATUSES = ["OPEN", "COLLECTING", "RECEIVING", "WAITING_DESCRIPTION", "ACTIVE", "PENDING"];

/** Convierte "FIVE" / "5" / "4.0" en número 1-5. */
export function ratingToNumber(rating: string | null | undefined): number | null {
  if (!rating) return null;
  const words: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const upper = rating.trim().toUpperCase();
  if (upper in words) return words[upper];
  const n = Number.parseFloat(upper.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Variantes de texto de un rating para filtrar en BD (rating es TEXT). */
export function ratingVariants(n: number): string[] {
  const words = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE"];
  return [String(n), `${n}.0`, words[n], words[n].toLowerCase(), `STAR_RATING_${words[n]}`];
}
