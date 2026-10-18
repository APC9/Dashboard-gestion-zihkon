import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDefinition } from "@/lib/n8n/workflows";

/** Servidor HTTP local que imita a n8n. Cada test decide la respuesta. */
let server: Server;
let baseUrl = "";
let calls: { path: string; headers: IncomingHttpHeaders; body: string }[] = [];
let reply: (path: string) => { status: number; body: string; delayMs?: number } = () => ({ status: 200, body: "{}" });

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls.push({ path: req.url ?? "", headers: req.headers, body });
      const r = reply(req.url ?? "");
      setTimeout(() => {
        if (res.destroyed) return;
        res.writeHead(r.status, { "content-type": "application/json" }).end(r.body);
      }, r.delayMs ?? 0);
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhook`;
  process.env.N8N_WEBHOOK_BASE_URL = baseUrl;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

beforeEach(() => {
  calls = [];
  reply = () => ({ status: 200, body: '{"ok":true}' });
});

const wf = (over: Partial<WorkflowDefinition> = {}) =>
  ({ id: "t", name: "t", description: "", category: "system", resource: "none", envPath: "N8N_TEST_PATH_NO_EXISTE", defaultPath: "/prueba/ruta", data: {} as never, manual: false, ...over }) as WorkflowDefinition;

const envelope = {
  event: "test.event",
  requested_by: { id: "admin", email: "a@b.c", role: "ADMIN" },
  client_system: "clients" as const,
  client_id: "11111111-1111-1111-1111-111111111111",
  resource: { type: "client", id: "11111111-1111-1111-1111-111111111111" },
  data: { a: 1 },
};

async function client() {
  return import("@/lib/n8n/client");
}

describe("callN8nWebhook", () => {
  it("firma la petición con secreto, timestamp y HMAC-SHA256 del cuerpo", async () => {
    const { callN8nWebhook } = await client();
    const r = await callN8nWebhook(wf(), envelope);
    expect(r).toMatchObject({ ok: true, status: 200, data: { ok: true } });
    const [c] = calls;
    expect(c.path).toBe("/webhook/prueba/ruta");
    const secret = process.env.N8N_WEBHOOK_SECRET!;
    expect(c.headers["x-zihkon-secret"]).toBe(secret);
    const expected = createHmac("sha256", secret).update(`${c.headers["x-zihkon-timestamp"]}.${c.body}`).digest("hex");
    expect(c.headers["x-zihkon-signature"]).toBe(`sha256=${expected}`);
    const sent = JSON.parse(c.body);
    expect(sent.request_id).toBe(r.requestId);
    expect(sent.request_id).toBe(c.headers["x-zihkon-request-id"]);
    expect(sent.client_id).toBe(envelope.client_id);
  });

  it("cada llamada lleva un request_id distinto (clave de idempotencia para n8n)", async () => {
    const { callN8nWebhook } = await client();
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) ids.add((await callN8nWebhook(wf(), envelope)).requestId);
    expect(ids.size).toBe(5);
  });

  it("respuesta no 2xx → ok:false con estado, sin lanzar", async () => {
    reply = () => ({ status: 500, body: '{"message":"Workflow could not be started!"}' });
    const { callN8nWebhook } = await client();
    const r = await callN8nWebhook(wf(), envelope);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(500);
    expect(r.data).toEqual({ message: "Workflow could not be started!" });
  });

  it("respuesta no JSON se devuelve como texto; vacía como null", async () => {
    const { callN8nWebhook } = await client();
    reply = () => ({ status: 200, body: "Workflow was started" });
    expect((await callN8nWebhook(wf(), envelope)).data).toBe("Workflow was started");
    reply = () => ({ status: 200, body: "" });
    expect((await callN8nWebhook(wf(), envelope)).data).toBeNull();
  });

  it("tiempo de espera agotado → UpstreamError 502", async () => {
    reply = () => ({ status: 200, body: "{}", delayMs: 1500 });
    const { callN8nWebhook } = await client();
    await expect(callN8nWebhook(wf({ timeoutMs: 200 }), envelope)).rejects.toMatchObject({ status: 502, message: "n8n: tiempo de espera agotado" });
  });

  it("n8n caído → UpstreamError 502 'no se pudo conectar'", async () => {
    // env() se cachea por módulo: se recarga con una URL a un puerto cerrado.
    vi.resetModules();
    process.env.N8N_WEBHOOK_BASE_URL = "http://127.0.0.1:9/webhook";
    try {
      const { callN8nWebhook } = await client();
      await expect(callN8nWebhook(wf(), envelope)).rejects.toMatchObject({ status: 502, message: "n8n: no se pudo conectar" });
    } finally {
      process.env.N8N_WEBHOOK_BASE_URL = baseUrl;
      vi.resetModules();
    }
  });

  it("no reintenta: un fallo de n8n produce exactamente una llamada", async () => {
    reply = () => ({ status: 503, body: "{}" });
    const { callN8nWebhook } = await client();
    await callN8nWebhook(wf(), envelope);
    expect(calls).toHaveLength(1);
  });
});

describe("callN8nWebhook sin configuración", () => {
  it("sin N8N_WEBHOOK_BASE_URL → 503 N8N_NOT_CONFIGURED y no llama a nadie", async () => {
    vi.resetModules();
    const prev = process.env.N8N_WEBHOOK_BASE_URL;
    delete process.env.N8N_WEBHOOK_BASE_URL;
    try {
      const { callN8nWebhook, isN8nConfigured } = await client();
      expect(isN8nConfigured()).toBe(false);
      await expect(callN8nWebhook(wf(), envelope)).rejects.toMatchObject({ status: 503, code: "N8N_NOT_CONFIGURED" });
      expect(calls).toHaveLength(0);
    } finally {
      process.env.N8N_WEBHOOK_BASE_URL = prev;
      vi.resetModules();
    }
  });
});
