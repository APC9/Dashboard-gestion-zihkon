import "server-only";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import type { Actor } from "@/lib/auth/types";
import type { TriggerResult } from "@/lib/n8n/triggers";

export interface N8nOutcome {
  ok: boolean;
  message: string;
  requestId?: string;
}

/** Ejecuta un trigger n8n sin que un fallo de n8n revierta el cambio ya guardado en BD. */
export async function safeTrigger(fn: () => Promise<TriggerResult>): Promise<N8nOutcome> {
  try {
    const r = await fn();
    return { ok: r.ok, message: r.message, requestId: r.requestId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Error al contactar con n8n" };
  }
}

/** Registra una acción humana sobre una reseña. */
export async function logReviewAction(
  actor: Actor,
  req: Request,
  review: { id: number; reviewId: string | null; clientId: number | null; gbpClient?: { businessName: string | null } | null },
  action: string,
  message: string,
  n8n?: N8nOutcome | null,
) {
  await logActivity(actor, {
    action,
    clientId: review.clientId != null ? String(review.clientId) : null,
    clientLabel: review.gbpClient?.businessName,
    resourceType: "gbp_review",
    resourceId: review.reviewId ?? String(review.id),
    ip: getRequestIp(req),
    result: n8n && !n8n.ok ? "ERROR" : "SUCCESS",
    message: n8n && !n8n.ok ? `${message} (n8n: ${n8n.message})` : message,
  });
}
