import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError, ForbiddenError } from "./errors";

/** JSON seguro: BigInt → string. */
export function json(data: unknown, init?: ResponseInit) {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new NextResponse(body, {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...init?.headers },
  });
}

export class ValidationError extends AppError {
  constructor(public issues: Record<string, string[]>) {
    super("Datos no válidos", 400, "VALIDATION_ERROR");
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError({ _root: ["El cuerpo de la petición no es JSON válido"] });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  return parsed.data;
}

export function parseParams<T>(value: unknown, schema: ZodType<T>): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  return parsed.data;
}

export function searchParamsObject(req: NextRequest) {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

/** Protección CSRF básica: las peticiones que modifican datos deben venir del mismo origen. */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // peticiones server-to-server sin cookie de sesión no pasan el auth igualmente
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ForbiddenError("Origen no permitido");
  } catch (e) {
    if (e instanceof ForbiddenError) throw e;
    throw new ForbiddenError("Origen no permitido");
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return json({ error: error.message, code: error.code, issues: error.issues }, { status: 400 });
  }
  if (error instanceof AppError) {
    return json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return json({ error: "Recurso no encontrado", code: "NOT_FOUND" }, { status: 404 });
    if (error.code === "P2002") return json({ error: "Ya existe un registro con esos datos", code: "CONFLICT" }, { status: 409 });
    if (error.code === "P2003")
      return json({ error: "El registro tiene datos relacionados", code: "CONFLICT" }, { status: 409 });
  }
  console.error("[api] Error no controlado", error);
  return json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<unknown>;

/**
 * Envoltorio común de los Route Handlers: CSRF, serialización y errores.
 * La autenticación/autorización se hace explícitamente dentro de cada handler
 * (requireAdmin / assertClientAccess) para que sea visible al leer la ruta.
 */
export function route<C>(fn: Handler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      assertSameOrigin(req);
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
