import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAttempts, clientIpFromHeaders, isRateLimited, registerFailedAttempt } from "@/lib/auth/rate-limit";

describe("límite de intentos de login", () => {
  afterEach(() => vi.useRealTimers());

  it("bloquea tras 8 intentos fallidos y se libera al acertar", () => {
    const key = "1.2.3.4:a@b.c";
    for (let i = 0; i < 7; i++) registerFailedAttempt(key);
    expect(isRateLimited(key)).toBe(false);
    registerFailedAttempt(key);
    expect(isRateLimited(key)).toBe(true);
    clearAttempts(key);
    expect(isRateLimited(key)).toBe(false);
  });

  it("la ventana caduca a los 15 minutos", () => {
    vi.useFakeTimers();
    const key = "5.6.7.8:x@y.z";
    for (let i = 0; i < 8; i++) registerFailedAttempt(key);
    expect(isRateLimited(key)).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(isRateLimited(key)).toBe(false);
  });

  it("cada IP+email cuenta por separado", () => {
    for (let i = 0; i < 8; i++) registerFailedAttempt("9.9.9.9:victima@x.com");
    expect(isRateLimited("8.8.8.8:victima@x.com")).toBe(false);
  });
});

describe("IP del cliente para el límite", () => {
  it("usa la última entrada de X-Forwarded-For (la que añade el proxy), no la que envía el cliente", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" })).toBe("203.0.113.7");
    expect(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.7" })).toBe("203.0.113.7");
  });

  it("cabecera repetida: toma la última de todas", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": ["9.9.9.9", "203.0.113.8"] })).toBe("203.0.113.8");
  });

  it("sin X-Forwarded-For usa X-Real-IP o 'unknown'", () => {
    expect(clientIpFromHeaders({ "x-real-ip": " 198.51.100.1 " })).toBe("198.51.100.1");
    expect(clientIpFromHeaders({ "x-forwarded-for": " , " })).toBe("unknown");
    expect(clientIpFromHeaders({})).toBe("unknown");
  });

  it("rotar la parte falsificada no cambia la clave del bloqueo", () => {
    const keys = new Set(Array.from({ length: 10 }, (_, i) => clientIpFromHeaders({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.9` })));
    expect([...keys]).toEqual(["203.0.113.9"]);
  });
});
