import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { AppError, UpstreamError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import type { WorkflowDefinition } from "./workflows";

export interface N8nEnvelope {
  event: string;
  request_id: string;
  requested_at: string;
  requested_by: { id: string; email: string; role: string };
  /** "clients" (UUID) o "gbp_clients" (UUID del perfil): indica a qué sistema pertenece client_id. */
  client_system: "clients" | "gbp_clients" | null;
  client_id: string | number | null;
  resource: { type: string; id: string | number | null };
  data: Record<string, unknown>;
}

export interface N8nCallResult {
  ok: boolean;
  status: number;
  requestId: string;
  durationMs: number;
  data: unknown;
}

export function isN8nConfigured() {
  return Boolean(process.env.N8N_WEBHOOK_BASE_URL && process.env.N8N_WEBHOOK_SECRET);
}

function resolveWebhookUrl(workflow: WorkflowDefinition) {
  const { N8N_WEBHOOK_BASE_URL } = env();
  if (!N8N_WEBHOOK_BASE_URL) throw new AppError("n8n no está configurado (N8N_WEBHOOK_BASE_URL)", 503, "N8N_NOT_CONFIGURED");
  const path = (process.env[workflow.envPath] || workflow.defaultPath).replace(/^\/+/, "");
  return `${N8N_WEBHOOK_BASE_URL.replace(/\/+$/, "")}/${path}`;
}

/**
 * Llama a un webhook de n8n. Solo se ejecuta en servidor.
 *
 * Autenticación (configurar en el nodo Webhook de n8n):
 *  - Header Auth: `X-Zihkon-Secret: <N8N_WEBHOOK_SECRET>`
 *  - Opcionalmente verificar `X-Zihkon-Signature` = HMAC-SHA256(secret, `${timestamp}.${body}`)
 */
export async function callN8nWebhook(
  workflow: WorkflowDefinition,
  envelope: Omit<N8nEnvelope, "request_id" | "requested_at">,
): Promise<N8nCallResult> {
  const { N8N_WEBHOOK_SECRET, N8N_WEBHOOK_TIMEOUT_MS } = env();
  if (!N8N_WEBHOOK_SECRET) throw new AppError("n8n no está configurado (N8N_WEBHOOK_SECRET)", 503, "N8N_NOT_CONFIGURED");

  const url = resolveWebhookUrl(workflow);
  const requestId = randomUUID();
  const body = JSON.stringify({ ...envelope, request_id: requestId, requested_at: new Date().toISOString() });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", N8N_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest("hex");

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-zihkon-secret": N8N_WEBHOOK_SECRET,
        "x-zihkon-timestamp": timestamp,
        "x-zihkon-signature": `sha256=${signature}`,
        "x-zihkon-request-id": requestId,
      },
      body,
      signal: AbortSignal.timeout(workflow.timeoutMs ?? N8N_WEBHOOK_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "tiempo de espera agotado" : "no se pudo conectar";
    throw new UpstreamError(`n8n: ${reason}`);
  }

  const durationMs = Date.now() - started;
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON: se devuelve como texto */
  }

  return { ok: response.ok, status: response.status, requestId, durationMs, data };
}
