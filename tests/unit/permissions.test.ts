import { describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/api/errors";
import {
  assertAdmin,
  assertClientAccess,
  assertGbpAccess,
  canAccessClient,
  clientScope,
  gbpReviewScope,
  gbpScope,
} from "@/lib/auth/permissions";
import { admin, clientActor } from "../helpers/db";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("aislamiento entre clientes", () => {
  it("el administrador accede a todo y no tiene filtro", () => {
    expect(canAccessClient(admin, A)).toBe(true);
    expect(clientScope(admin)).toEqual({});
    expect(gbpScope(admin)).toEqual({});
    expect(() => assertAdmin(admin)).not.toThrow();
  });

  it("un cliente solo accede a su propio client_id", () => {
    const actor = clientActor(A);
    expect(canAccessClient(actor, A)).toBe(true);
    expect(canAccessClient(actor, B)).toBe(false);
    expect(canAccessClient(actor, null)).toBe(false);
    expect(() => assertClientAccess(actor, B)).toThrow(ForbiddenError);
  });

  it("el filtro de un cliente sin client_id no devuelve nada (UUID nulo)", () => {
    const actor = { ...clientActor(A), clientId: null };
    expect(clientScope(actor)).toEqual({ clientId: "00000000-0000-0000-0000-000000000000" });
    expect(canAccessClient(actor, null)).toBe(false);
  });

  it("perfiles GBP: solo los vinculados explícitamente", () => {
    const actor = clientActor(A, ["gbp-1"]);
    expect(() => assertGbpAccess(actor, "gbp-1")).not.toThrow();
    expect(() => assertGbpAccess(actor, "gbp-2")).toThrow(ForbiddenError);
    expect(gbpScope(actor)).toEqual({ id: { in: ["gbp-1"] } });
    expect(gbpReviewScope(actor)).toEqual({ clientId: { in: ["gbp-1"] } });
  });

  it("los recursos globales son solo para administradores", () => {
    expect(() => assertAdmin(clientActor(A))).toThrow(ForbiddenError);
  });
});
