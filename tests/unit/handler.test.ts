import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/api/errors";
import { parseBody, route } from "@/lib/api/handler";

const req = (method: string, headers: Record<string, string> = {}, body?: string) =>
  new NextRequest("http://localhost:3000/api/x", { method, headers, body });

describe("route(): errores y CSRF", () => {
  it("devuelve JSON con el resultado y sin caché", async () => {
    const res = await route(async () => ({ hola: 1 }))(req("GET"), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hola: 1 });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serializa BigInt como texto", async () => {
    const res = await route(async () => ({ n: BigInt("9007199254740993") }))(req("GET"), {});
    expect(await res.json()).toEqual({ n: "9007199254740993" });
  });

  it("traduce AppError a su estado y código", async () => {
    const res = await route(async () => {
      throw new NotFoundError("No está");
    })(req("GET"), {});
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No está", code: "NOT_FOUND" });
  });

  it("errores de validación → 400 con los campos", async () => {
    const res = await route(async (r) => parseBody(r, z.object({ a: z.number() })))(
      req("POST", { "content-type": "application/json" }, JSON.stringify({ a: "x" })),
      {},
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.issues.a).toBeDefined();
  });

  it("JSON mal formado → 400", async () => {
    const res = await route(async (r) => parseBody(r, z.object({})))(req("POST", {}, "{no-json"), {});
    expect(res.status).toBe(400);
  });

  it("errores de Prisma: duplicado y FK → 409, inexistente → 404", async () => {
    const err = (code: string) => new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: "test" });
    for (const [code, status] of [["P2002", 409], ["P2003", 409], ["P2025", 404]] as const) {
      const res = await route(async () => {
        throw err(code);
      })(req("GET"), {});
      expect(res.status).toBe(status);
    }
  });

  it("errores inesperados → 500 sin filtrar detalles internos", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await route(async () => {
      throw new Error("password=secreto en la cadena de conexión");
    })(req("GET"), {});
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secreto");
    spy.mockRestore();
  });

  it("CSRF: rechaza POST con Origin de otro dominio sin ejecutar el handler", async () => {
    const handler = vi.fn(async () => ({ ok: true }));
    const res = await route(handler)(req("POST", { origin: "https://atacante.com", host: "localhost:3000" }, "{}"), {});
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("CSRF: rechaza Origin mal formado", async () => {
    const res = await route(async () => ({ ok: true }))(req("DELETE", { origin: "null", host: "localhost:3000" }), {});
    expect(res.status).toBe(403);
  });

  it("CSRF: acepta POST del mismo origen", async () => {
    const res = await route(async () => ({ ok: true }))(req("POST", { origin: "http://localhost:3000", host: "localhost:3000" }, "{}"), {});
    expect(res.status).toBe(200);
  });

  it("CSRF: no exige Origin en GET", async () => {
    const res = await route(async () => ({ ok: true }))(req("GET", { origin: "https://atacante.com", host: "localhost:3000" }), {});
    expect(res.status).toBe(200);
  });

  it("respeta respuestas ya construidas", async () => {
    const res = await route(async () => Response.json({ creado: true }, { status: 201 }))(req("GET"), {});
    expect(res.status).toBe(201);
  });

  it("AppError genérico conserva el código", async () => {
    const res = await route(async () => {
      throw new AppError("Ya usada", 409, "TRIAL_ALREADY_USED");
    })(req("GET"), {});
    expect(await res.json()).toEqual({ error: "Ya usada", code: "TRIAL_ALREADY_USED" });
  });
});
