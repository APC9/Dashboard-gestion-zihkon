import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAttempts, isRateLimited, registerFailedAttempt } from "@/lib/auth/rate-limit";

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
