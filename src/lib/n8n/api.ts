import "server-only";

/**
 * Lectura OPCIONAL de ejecuciones mediante la API REST pública de n8n
 * (N8N_API_URL + N8N_API_KEY). Si no está configurada, la página de
 * Automatizaciones muestra solo el catálogo y los errores registrados en BD.
 */

export interface N8nExecution {
  id: string;
  workflowId: string;
  workflowName: string | null;
  status: string;
  mode: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  durationMs: number | null;
}

export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
}

function apiConfig() {
  const url = process.env.N8N_API_URL;
  const key = process.env.N8N_API_KEY;
  if (!url || !key) return null;
  const base = url.replace(/\/+$/, "");
  return { base: base.endsWith("/api/v1") ? base : `${base}/api/v1`, key };
}

export function isN8nApiConfigured() {
  return apiConfig() !== null;
}

async function n8nGet<T>(path: string): Promise<T> {
  const cfg = apiConfig();
  if (!cfg) throw new Error("API de n8n no configurada");
  const res = await fetch(`${cfg.base}${path}`, {
    headers: { "X-N8N-API-KEY": cfg.key, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`n8n API ${res.status}`);
  return (await res.json()) as T;
}

export async function listN8nWorkflows(): Promise<N8nWorkflowSummary[]> {
  const res = await n8nGet<{ data: Array<{ id: string; name: string; active: boolean }> }>("/workflows?limit=250");
  return res.data.map((w) => ({ id: String(w.id), name: w.name, active: w.active }));
}

export async function listN8nExecutions(limit = 50): Promise<N8nExecution[]> {
  const [executions, workflows] = await Promise.all([
    n8nGet<{
      data: Array<{
        id: string | number;
        workflowId: string | number;
        status?: string;
        finished?: boolean;
        mode?: string;
        startedAt?: string;
        stoppedAt?: string;
      }>;
    }>(`/executions?limit=${Math.min(Math.max(limit, 1), 250)}&includeData=false`),
    listN8nWorkflows().catch(() => [] as N8nWorkflowSummary[]),
  ]);
  const names = new Map(workflows.map((w) => [w.id, w.name]));
  return executions.data.map((e) => {
    const started = e.startedAt ? Date.parse(e.startedAt) : NaN;
    const stopped = e.stoppedAt ? Date.parse(e.stoppedAt) : NaN;
    return {
      id: String(e.id),
      workflowId: String(e.workflowId),
      workflowName: names.get(String(e.workflowId)) ?? null,
      status: e.status ?? (e.finished ? "success" : "running"),
      mode: e.mode ?? null,
      startedAt: e.startedAt ?? null,
      stoppedAt: e.stoppedAt ?? null,
      durationMs: Number.isFinite(started) && Number.isFinite(stopped) ? stopped - started : null,
    };
  });
}
