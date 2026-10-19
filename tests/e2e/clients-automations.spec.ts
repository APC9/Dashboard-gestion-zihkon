import { expect, test } from "@playwright/test";
import { insertClient, n8nCalls, resetDb, resetN8nCalls, withDb } from "./db";
import { loginAsAdmin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetDb();
  await resetN8nCalls();
  await loginAsAdmin(page);
});

test.describe("gestión de clientes", () => {
  test("alta de cliente desde el formulario", async ({ page }) => {
    await page.goto("/clients/new");
    await page.locator("#clientName").fill("Pizzería E2E");
    await page.locator("#whatsappE164").fill("+34 600 123 456");
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
    const rows = await withDb((db) => db.query("SELECT client_name, whatsapp_e164 FROM public.clients"));
    expect(rows.rows).toEqual([{ client_name: "Pizzería E2E", whatsapp_e164: "+34600123456" }]);
  });

  test("número español incompleto: el formulario lo rechaza y no se crea", async ({ page }) => {
    await page.goto("/clients/new");
    await page.locator("#clientName").fill("Bar Corto");
    await page.locator("#whatsappE164").fill("+3460483237");
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.getByText(/9 cifras/)).toBeVisible();
    expect((await withDb((db) => db.query("SELECT count(*)::int AS n FROM public.clients"))).rows[0].n).toBe(0);
  });

  test("WhatsApp duplicado: muestra el conflicto", async ({ page }) => {
    await insertClient("Existente", "+34600123456");
    await page.goto("/clients/new");
    await page.locator("#clientName").fill("Nuevo");
    await page.locator("#whatsappE164").fill("34600123456");
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.getByText(/ya pertenece a "Existente"/)).toBeVisible();
  });

  test("el listado muestra los clientes de la BD de pruebas", async ({ page }) => {
    await insertClient("Cliente Listado Uno", "+34600000101");
    await insertClient("Cliente Listado Dos", "+34600000102");
    await page.goto("/clients");
    await expect(page.getByText("Cliente Listado Uno")).toBeVisible();
    await expect(page.getByText("Cliente Listado Dos")).toBeVisible();
  });
});

test.describe("referidos", () => {
  test("alta con código de referido y mes gratis tras el 2.º pago", async ({ page }) => {
    const dueño = await insertClient("Bar Dueño", "+34600000501");
    const codigo = (await withDb((db) => db.query("SELECT referral_code FROM public.clients WHERE client_id = $1", [dueño]))).rows[0].referral_code;
    await page.goto("/clients/new");
    await page.locator("#clientName").fill("Bar Recomendado");
    await page.locator("#whatsappE164").fill("+34600000502");
    await page.locator("#email").fill("hola@recomendado.es");
    await page.locator("#referralCode").fill(codigo.toLowerCase());
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.getByText("Vino recomendado por")).toBeVisible();
    await expect(page.getByText("hola@recomendado.es")).toBeVisible();
    await expect(page.getByTestId("referral-code")).toHaveText(/^ZK[0-9A-Z]{5}$/);

    await page.goto(`/clients/${dueño}`);
    await expect(page.getByText("Esperando su 2.º pago")).toBeVisible();
    await page.getByRole("button", { name: "2.º mes pagado" }).click();
    await expect(page.getByText("1 mes gratis por aplicar")).toBeVisible();
    await page.getByRole("button", { name: "Mes gratis aplicado" }).click();
    await expect(page.getByText("Mes gratis aplicado", { exact: true })).toBeVisible();
  });

  test("código de referido inexistente: error en el campo y no se crea", async ({ page }) => {
    await page.goto("/clients/new");
    await page.locator("#clientName").fill("Bar Sin Código");
    await page.locator("#whatsappE164").fill("+34600000503");
    await page.locator("#referralCode").fill("ZK99999");
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.getByText("No existe ningún cliente con ese código")).toBeVisible();
    expect((await withDb((db) => db.query("SELECT count(*)::int AS n FROM public.clients"))).rows[0].n).toBe(0);
  });
});

test.describe("ciclo de vida de automatizaciones", () => {
  test("activar, guardar y avisar; después finalizar", async ({ page }) => {
    const id = await insertClient("Cliente Automat", "+34600000201");
    await page.goto(`/clients/${id}?tab=automations`);
    await page.locator("#automation-web_whatsapp").click();
    await expect(page.getByText("se activará")).toBeVisible();
    await page.getByRole("button", { name: "Guardar y avisar al cliente" }).click();
    await expect(page.getByText("Cambios guardados y cliente avisado por WhatsApp")).toBeVisible();

    let calls = await n8nCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/webhook/zihkon/client/automations-changed");
    expect(calls[0].body).toMatchObject({ client_id: id, data: { activated: ["web_whatsapp"], deactivated: [] } });

    await resetN8nCalls();
    await page.locator("#automation-web_whatsapp").click();
    await expect(page.getByText("finalizará")).toBeVisible();
    await page.getByRole("button", { name: "Guardar y avisar al cliente" }).click();
    // El aviso del primer guardado puede seguir visible: se espera a que llegue la segunda llamada a n8n.
    await expect.poll(async () => (await n8nCalls()).length).toBe(1);
    calls = await n8nCalls();
    expect(calls[0].body).toMatchObject({ data: { activated: [], deactivated: ["web_whatsapp"] } });
    const row = await withDb((db) => db.query("SELECT enabled FROM public.client_automations WHERE client_id = $1", [id]));
    expect(row.rows[0].enabled).toBe(false);
  });

  test("multicanal y GBP: al activar una se apaga la otra en la interfaz", async ({ page }) => {
    const id = await insertClient("Cliente Exclusivo", "+34600000301");
    await page.goto(`/clients/${id}?tab=automations`);
    const multi = page.locator("#automation-publicaciones");
    const gbp = page.locator("#automation-publicaciones_gbp");
    await multi.click();
    await expect(multi).toHaveAttribute("aria-checked", "true");
    await gbp.click();
    await expect(gbp).toHaveAttribute("aria-checked", "true");
    await expect(multi).toHaveAttribute("aria-checked", "false");
  });

  test("prueba gratuita: activar muestra 0/4 y avisa una sola vez", async ({ page }) => {
    const id = await insertClient("Cliente Prueba", "+34600000401");
    await page.goto(`/clients/${id}?tab=automations`);
    await page.getByRole("button", { name: "Activar prueba 7 días" }).click();
    await expect(page.getByText("Prueba activada y cliente avisado por WhatsApp")).toBeVisible();
    await expect(page.getByText("0/4")).toBeVisible();
    expect(await n8nCalls()).toHaveLength(1);
    const row = await withDb((db) =>
      db.query("SELECT automation_key, enabled, trial_posts_limit FROM public.client_automations WHERE client_id = $1 AND trial_started_at IS NOT NULL", [id]),
    );
    expect(row.rows).toEqual([{ automation_key: "publicaciones_gbp", enabled: true, trial_posts_limit: 4 }]);
  });
});
