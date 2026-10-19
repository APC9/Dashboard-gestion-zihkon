import { expect, test, type APIRequestContext } from "@playwright/test";
import { login, loginAsAdmin } from "./helpers";

test.describe("autenticación", () => {
  test("sin sesión redirige al login conservando la ruta", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fclients/);
  });

  test("la API sin sesión responde 401", async ({ request }) => {
    const res = await request.get("/api/clients");
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("healthcheck público sin datos sensibles", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    expect(JSON.stringify(await res.json())).not.toMatch(/postgres(ql)?:\/\/|password|secret/i);
  });

  test("contraseña incorrecta muestra error y no entra", async ({ page }) => {
    await login(page, "admin@test.zihkon.local", "incorrecta");
    await expect(page.getByText("Email o contraseña incorrectos")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("el formulario de login nunca envía la contraseña en la URL", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form")).toHaveAttribute("method", "post");
  });

  test("email no válido se valida en el formulario", async ({ page }) => {
    await login(page, "no-es-email", "x");
    await expect(page.getByText("Introduce un email válido")).toBeVisible();
  });

  test("login correcto entra al panel y la API responde", async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get("/api/clients");
    expect(res.status()).toBe(200);
  });

  test("cabeceras de seguridad presentes", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("cookie de sesión falsificada no da acceso", async ({ context, page }) => {
    await context.addCookies([{ name: "next-auth.session-token", value: "eyJhbGciOiJIUzI1NiJ9.e30.falsa", url: "http://localhost:3300" }]);
    await page.goto("/clients");
    await expect(page).toHaveURL(/\/login/);
  });
});

/** Envía credenciales directamente a NextAuth y devuelve el error de la redirección (o null si entra). */
async function credentialsAttempt(request: APIRequestContext, email: string, password: string, ip: string) {
  const { csrfToken } = await (await request.get("/api/auth/csrf")).json();
  const res = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password, json: "true" },
    headers: { "x-forwarded-for": ip },
    maxRedirects: 0,
  });
  const location = res.headers()["location"] ?? (await res.json().catch(() => ({}))).url ?? "";
  return new URL(location, "http://localhost:3300").searchParams.get("error");
}

test.describe("fuerza bruta en el login", () => {
  test("tras 8 fallos desde la misma IP se bloquea (incluso con la contraseña buena)", async ({ request }) => {
    const email = "admin@test.zihkon.local";
    for (let i = 0; i < 8; i++) expect(await credentialsAttempt(request, email, `mala-${i}`, "10.0.0.1")).toBe("CredentialsSignin");
    const blocked = await credentialsAttempt(request, email, "Prueba-Panel-2026!", "10.0.0.1");
    expect(blocked).toContain("Demasiados intentos");
  });

  test("falsificar X-Forwarded-For no evita el bloqueo (Traefik añade la IP real al final)", async ({ request }) => {
    const email = "otro-objetivo@test.zihkon.local";
    // El atacante cambia la primera IP en cada intento; el proxy añade siempre su IP real al final.
    for (let i = 0; i < 8; i++) expect(await credentialsAttempt(request, email, `mala-${i}`, `10.1.0.${i}, 203.0.113.50`)).toBe("CredentialsSignin");
    expect(await credentialsAttempt(request, email, "otra", "10.1.0.99, 203.0.113.50")).toContain("Demasiados intentos");
  });
});
