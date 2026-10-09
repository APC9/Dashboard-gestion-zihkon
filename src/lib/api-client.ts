"use client";

import { toast } from "sonner";

/**
 * Cliente HTTP del navegador hacia la API interna (/api/*).
 * Nunca habla con n8n ni con PostgreSQL directamente.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  url: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 401) {
    // Recarga completa intencionada: la sesión caducó y hay que volver a pasar por el proxy.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError("Sesión caducada", 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Error ${res.status}`, res.status, data?.issues);
  }
  return data as T;
}

export function toastError(error: unknown, fallback = "Ha ocurrido un error") {
  if (error instanceof ApiError) {
    const firstIssue = error.issues ? Object.values(error.issues).flat()[0] : undefined;
    toast.error(error.message, firstIssue ? { description: firstIssue } : undefined);
  } else {
    toast.error(fallback);
  }
}

/** Muestra el resultado de una acción delegada a n8n. */
export function toastN8n(result: { n8n?: { ok: boolean; message: string } | null }, success: string) {
  if (!result.n8n) {
    toast.success(success);
  } else if (result.n8n.ok) {
    toast.success(success, { description: result.n8n.message });
  } else {
    toast.warning(success, { description: `n8n: ${result.n8n.message}` });
  }
}
