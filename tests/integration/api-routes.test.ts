import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/errors";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { admin, clientActor, makeClient, resetDb } from "../helpers/db";
import { startMockN8n } from "../helpers/mock-n8n";

/** La sesión de next-auth se sustituye por un actor controlado por cada test. */
const session = vi.hoisted(() => ({ actor: null as Actor | null }));
vi.mock("@/lib/auth/session", () => ({
  getActor: async () => session.actor,
  requireActor: async () => {
    if (!session.actor) throw new UnauthorizedError();
    return session.actor;
  },
  requireAdmin: async () => {
    if (!session.actor) throw new UnauthorizedError();
    if (session.actor.role !== "ADMIN") throw new ForbiddenError();
    return session.actor;
  },
}));

const clientsRoute = await import("@/app/api/clients/route");
const automationsRoute = await import("@/app/api/clients/[id]/automations/route");
const trialRoute = await import("@/app/api/clients/[id]/automations/trial/route");

let n8n: Awaited<ReturnType<typeof startMockN8n>>;
beforeAll(async () => {
  n8n = await startMockN8n();
  process.env.N8N_WEBHOOK_BASE_URL = n8n.url;
});
afterAll(async () => {
  await n8n.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  n8n.reset();
  session.actor = admin;
});

const ORIGIN = { origin: "http://localhost:3000", host: "localhost:3000" };
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = ORIGIN) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const newClient = {
  clientName: "Bar Ruta",
  whatsappE164: "+34600999888",
  metricoolBlogId: "",
  timezone: "",
  active: true,
};

describe("/api/clients", () => {
  it("sin sesión → 401", async () => {
    session.actor = null;
    expect((await clientsRoute.GET(req("GET", "/api/clients"), {})).status).toBe(401);
    expect((await clientsRoute.POST(req("POST", "/api/clients", newClient), {})).status).toBe(401);
    expect(await prisma.client.count()).toBe(0);
  });

  it("CLIENT no puede crear (403) y solo lista lo suyo", async () => {
    const [a] = [await makeClient(), await makeClient()];
    session.actor = clientActor(a.clientId);
    expect((await clientsRoute.POST(req("POST", "/api/clients", newClient), {})).status).toBe(403);
    const list = await (await clientsRoute.GET(req("GET", "/api/clients"), {})).json();
    expect(list.total).toBe(1);
    expect(list.items[0].clientId).toBe(a.clientId);
  });

  it("ADMIN crea (201); datos no válidos → 400 con campos; duplicado → 409", async () => {
    const res = await clientsRoute.POST(req("POST", "/api/clients", newClient), {});
    expect(res.status).toBe(201);
    expect((await res.json()).clientName).toBe("Bar Ruta");

    const bad = await clientsRoute.POST(req("POST", "/api/clients", { ...newClient, whatsappE164: "+3460099988" }), {});
    expect(bad.status).toBe(400);
    expect((await bad.json()).issues.whatsappE164).toBeDefined();

    expect((await clientsRoute.POST(req("POST", "/api/clients", { ...newClient, clientName: "Otro" }), {})).status).toBe(409);
  });

  it("CSRF: POST desde otro origen → 403 y no crea nada", async () => {
    const res = await clientsRoute.POST(req("POST", "/api/clients", newClient, { origin: "https://evil.example", host: "localhost:3000" }), {});
    expect(res.status).toBe(403);
    expect(await prisma.client.count()).toBe(0);
  });

  it("filtros de listado no válidos → 400", async () => {
    expect((await clientsRoute.GET(req("GET", "/api/clients?pageSize=100000"), {})).status).toBe(400);
  });
});

describe("/api/clients/[id]/automations", () => {
  it("id no UUID → 400; cliente inexistente → 404", async () => {
    expect((await automationsRoute.GET(req("GET", "/api/clients/x/automations"), ctx("x"))).status).toBe(400);
    const missing = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    expect((await automationsRoute.GET(req("GET", "/"), ctx(missing))).status).toBe(404);
  });

  it("guarda y avisa a n8n con los cambios firmados", async () => {
    const c = await makeClient();
    const res = await automationsRoute.POST(req("POST", "/", { automations: { web_whatsapp: true } }), ctx(c.clientId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ activated: ["web_whatsapp"], deactivated: [], notify: { sent: true } });
    expect(n8n.calls).toHaveLength(1);
    const call = n8n.calls[0];
    expect(call.path).toBe("/webhook/zihkon/client/automations-changed");
    expect(call.headers["x-zihkon-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(call.body).toMatchObject({ event: "client-automations-notify", client_id: c.clientId, data: { activated: ["web_whatsapp"], deactivated: [] } });
  });

  it("si n8n falla (500) los cambios se guardan igual y se informa el error", async () => {
    const c = await makeClient();
    n8n.setReply(() => ({ status: 500, body: { message: "boom" } }));
    const body = await (await automationsRoute.POST(req("POST", "/", { automations: { web_whatsapp: true } }), ctx(c.clientId))).json();
    expect(body.notify.sent).toBe(false);
    expect(body.notify.error).toContain("500");
    expect(await prisma.clientAutomation.count({ where: { clientId: c.clientId, enabled: true } })).toBe(1);
  });

  it("si n8n corta la conexión los cambios se guardan igual", async () => {
    const c = await makeClient();
    n8n.setReply(() => ({ status: 200, drop: true }));
    const body = await (await automationsRoute.POST(req("POST", "/", { automations: { resenas_gbp: true } }), ctx(c.clientId))).json();
    expect(body.notify).toEqual({ sent: false, error: "n8n: no se pudo conectar" });
    expect(await prisma.clientAutomation.count({ where: { enabled: true } })).toBe(1);
  });

  it("guardar sin cambios no llama a n8n (no se reenvía el aviso)", async () => {
    const c = await makeClient();
    await automationsRoute.POST(req("POST", "/", { automations: { web_whatsapp: true } }), ctx(c.clientId));
    await automationsRoute.POST(req("POST", "/", { automations: { web_whatsapp: true } }), ctx(c.clientId));
    expect(n8n.calls).toHaveLength(1);
  });

  it("cuerpo con campos extra → 400 (esquema estricto); CLIENT → 403", async () => {
    const c = await makeClient();
    expect((await automationsRoute.POST(req("POST", "/", { automations: {}, hack: 1 }), ctx(c.clientId))).status).toBe(400);
    session.actor = clientActor(c.clientId);
    expect((await automationsRoute.POST(req("POST", "/", { automations: { web_whatsapp: true } }), ctx(c.clientId))).status).toBe(403);
    expect(n8n.calls).toHaveLength(0);
  });

  it("CLIENT no puede leer las automatizaciones de otro cliente", async () => {
    const [a, b] = [await makeClient(), await makeClient()];
    session.actor = clientActor(a.clientId);
    expect((await automationsRoute.GET(req("GET", "/"), ctx(b.clientId))).status).toBe(403);
    expect((await automationsRoute.GET(req("GET", "/"), ctx(a.clientId))).status).toBe(200);
  });
});

describe("/api/clients/[id]/automations/trial", () => {
  it("activa la prueba, avisa una vez y la segunda vez → 409 sin aviso", async () => {
    const c = await makeClient();
    const first = await trialRoute.POST(req("POST", "/", { action: "start" }), ctx(c.clientId));
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body.trial).toMatchObject({ automationKey: "publicaciones_gbp", postsLimit: 4, postsUsed: 0, daysLeft: 7 });
    expect(body.notify.sent).toBe(true);
    expect(n8n.calls).toHaveLength(1);

    const again = await trialRoute.POST(req("POST", "/", { action: "start" }), ctx(c.clientId));
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe("TRIAL_ALREADY_USED");
    expect(n8n.calls).toHaveLength(1);
  });

  it("doble clic simultáneo → un solo aviso de WhatsApp", async () => {
    const c = await makeClient();
    const statuses = (
      await Promise.all([
        trialRoute.POST(req("POST", "/", { action: "start" }), ctx(c.clientId)),
        trialRoute.POST(req("POST", "/", { action: "start" }), ctx(c.clientId)),
      ])
    ).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
    expect(n8n.calls).toHaveLength(1);
  });

  it("convertir no avisa; acción desconocida → 400", async () => {
    const c = await makeClient();
    await trialRoute.POST(req("POST", "/", { action: "start" }), ctx(c.clientId));
    n8n.reset();
    const res = await trialRoute.POST(req("POST", "/", { action: "convert" }), ctx(c.clientId));
    expect((await res.json()).trial.active).toBe(false);
    expect(n8n.calls).toHaveLength(0);
    expect((await trialRoute.POST(req("POST", "/", { action: "borrar" }), ctx(c.clientId))).status).toBe(400);
  });

  it("CLIENT no puede activar pruebas; puede consultar la suya", async () => {
    const c = await makeClient();
    session.actor = clientActor(c.clientId);
    expect((await trialRoute.POST(req("POST", "/", { action: "start" }), ctx(c.clientId))).status).toBe(403);
    const get = await trialRoute.GET(req("GET", "/"), ctx(c.clientId));
    expect(get.status).toBe(200);
    expect(await get.json()).toBeNull();
  });
});
