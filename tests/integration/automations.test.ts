import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  convertClientTrial,
  getClientTrial,
  listClientAutomations,
  saveClientAutomations,
  setClientAutomation,
  startClientTrial,
  TRIAL_POSTS_LIMIT,
} from "@/lib/data/automations";
import { admin, clientActor, makeClient, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const enabledKeys = async (clientId: string) =>
  (await listClientAutomations(admin, clientId)).filter((a) => a.enabled).map((a) => a.automationKey).sort();

describe("saveClientAutomations", () => {
  it("activa y desactiva y devuelve solo lo que cambia", async () => {
    const c = await makeClient();
    const first = await saveClientAutomations(admin, c.clientId, { web_whatsapp: true, resenas_gbp: true });
    expect(first.activated.sort()).toEqual(["resenas_gbp", "web_whatsapp"]);
    expect(first.deactivated).toEqual([]);

    const second = await saveClientAutomations(admin, c.clientId, { web_whatsapp: true, resenas_gbp: false });
    expect(second.activated).toEqual([]);
    expect(second.deactivated).toEqual(["resenas_gbp"]);
    expect(await enabledKeys(c.clientId)).toEqual(["web_whatsapp"]);
  });

  it("guardar sin cambios no escribe nada", async () => {
    const c = await makeClient();
    const r = await saveClientAutomations(admin, c.clientId, { web_whatsapp: false });
    expect(r.activated).toEqual([]);
    expect(await prisma.clientAutomation.count()).toBe(0);
  });

  it("multicanal y GBP no pueden estar activas a la vez (ni juntas ni sumando a la existente)", async () => {
    const c = await makeClient();
    await expect(saveClientAutomations(admin, c.clientId, { publicaciones: true, publicaciones_gbp: true })).rejects.toMatchObject({
      status: 400,
      code: "AUTOMATIONS_EXCLUSIVE",
    });
    await saveClientAutomations(admin, c.clientId, { publicaciones: true });
    await expect(saveClientAutomations(admin, c.clientId, { publicaciones_gbp: true })).rejects.toMatchObject({ code: "AUTOMATIONS_EXCLUSIVE" });
    await expect(setClientAutomation(admin, c.clientId, "publicaciones_gbp", true)).rejects.toMatchObject({ code: "AUTOMATIONS_EXCLUSIVE" });
    // Cambiar de una a otra en la misma operación sí se permite.
    await saveClientAutomations(admin, c.clientId, { publicaciones: false, publicaciones_gbp: true });
    expect(await enabledKeys(c.clientId)).toEqual(["publicaciones_gbp"]);
  });

  it("automatización desconocida → 404 sin guardar nada", async () => {
    const c = await makeClient();
    await expect(saveClientAutomations(admin, c.clientId, { web_whatsapp: true, inventada: true })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.clientAutomation.count()).toBe(0);
  });

  it("cliente inexistente → 404", async () => {
    await expect(saveClientAutomations(admin, "00000000-0000-0000-0000-000000000001", { web_whatsapp: true })).rejects.toMatchObject({ status: 404 });
  });

  it("un usuario CLIENT no puede cambiar automatizaciones, ni siquiera las suyas", async () => {
    const c = await makeClient();
    await expect(saveClientAutomations(clientActor(c.clientId), c.clientId, { web_whatsapp: true })).rejects.toMatchObject({ status: 403 });
    await expect(setClientAutomation(clientActor(c.clientId), c.clientId, "web_whatsapp", true)).rejects.toMatchObject({ status: 403 });
  });

  it("un CLIENT ve sus automatizaciones pero no las de otro cliente", async () => {
    const [a, b] = [await makeClient(), await makeClient()];
    await expect(listClientAutomations(clientActor(a.clientId), a.clientId)).resolves.toHaveLength(4);
    await expect(listClientAutomations(clientActor(a.clientId), b.clientId)).rejects.toMatchObject({ status: 403 });
  });

  it("automatización del catálogo desactivada no se puede usar", async () => {
    const c = await makeClient();
    await prisma.automationCatalog.update({ where: { automationKey: "resenas_gbp" }, data: { active: false } });
    await expect(setClientAutomation(admin, c.clientId, "resenas_gbp", true)).rejects.toMatchObject({ status: 404 });
    await expect(saveClientAutomations(admin, c.clientId, { resenas_gbp: true })).rejects.toMatchObject({ status: 404 });
  });
});

describe("prueba gratuita", () => {
  it("activa 7 días, 4 publicaciones y la automatización", async () => {
    const c = await makeClient();
    await startClientTrial(admin, c.clientId, "publicaciones_gbp");
    const t = await getClientTrial(admin, c.clientId);
    expect(t).toMatchObject({ automationKey: "publicaciones_gbp", postsLimit: TRIAL_POSTS_LIMIT, postsUsed: 0, active: true, daysLeft: 7 });
    expect(t!.endsAt.getTime() - t!.startedAt.getTime()).toBe(7 * 86_400_000);
    expect(await enabledKeys(c.clientId)).toEqual(["publicaciones_gbp"]);
    expect((await listClientAutomations(admin, c.clientId)).find((a) => a.automationKey === "publicaciones_gbp")!.inTrial).toBe(true);
  });

  it("sin prueba → null", async () => {
    const c = await makeClient();
    expect(await getClientTrial(admin, c.clientId)).toBeNull();
  });

  it("solo una prueba por cliente (409), aunque ya haya terminado", async () => {
    const c = await makeClient();
    await startClientTrial(admin, c.clientId, "publicaciones_gbp");
    await expect(startClientTrial(admin, c.clientId, "publicaciones")).rejects.toMatchObject({ status: 409, code: "TRIAL_ALREADY_USED" });
    await convertClientTrial(admin, c.clientId);
    await expect(startClientTrial(admin, c.clientId, "publicaciones_gbp")).rejects.toMatchObject({ code: "TRIAL_ALREADY_USED" });
  });

  it("no hace falta prueba si ya tiene publicaciones activas (400)", async () => {
    const c = await makeClient();
    await saveClientAutomations(admin, c.clientId, { publicaciones: true });
    await expect(startClientTrial(admin, c.clientId, "publicaciones_gbp")).rejects.toMatchObject({ status: 400, code: "TRIAL_NOT_NEEDED" });
  });

  it("apagar la automatización durante la prueba la termina y no se puede repetir", async () => {
    const c = await makeClient();
    await startClientTrial(admin, c.clientId, "publicaciones_gbp");
    await saveClientAutomations(admin, c.clientId, { publicaciones_gbp: false });
    const t = await getClientTrial(admin, c.clientId);
    expect(t!.active).toBe(false);
    expect(t!.finishedAt).not.toBeNull();
    await expect(startClientTrial(admin, c.clientId, "publicaciones_gbp")).rejects.toMatchObject({ code: "TRIAL_ALREADY_USED" });
  });

  it("convertir: sigue activa y deja de ser prueba; sin prueba en curso → 400", async () => {
    const c = await makeClient();
    await expect(convertClientTrial(admin, c.clientId)).rejects.toMatchObject({ status: 400, code: "TRIAL_NOT_ACTIVE" });
    await startClientTrial(admin, c.clientId, "publicaciones_gbp");
    await convertClientTrial(admin, c.clientId);
    expect(await enabledKeys(c.clientId)).toEqual(["publicaciones_gbp"]);
    expect((await getClientTrial(admin, c.clientId))!.active).toBe(false);
    await expect(convertClientTrial(admin, c.clientId)).rejects.toMatchObject({ code: "TRIAL_NOT_ACTIVE" });
  });

  it("daysLeft redondea hacia arriba y es 0 al vencer (sigue abierta hasta que n8n la cierre)", async () => {
    const c = await makeClient();
    await startClientTrial(admin, c.clientId, "publicaciones_gbp");
    const setEnds = (ms: number) =>
      prisma.clientAutomation.update({
        where: { clientId_automationKey: { clientId: c.clientId, automationKey: "publicaciones_gbp" } },
        data: { trialStartedAt: new Date(Date.now() - 10 * 86_400_000), trialEndsAt: new Date(Date.now() + ms) },
      });
    await setEnds(36 * 3_600_000);
    expect((await getClientTrial(admin, c.clientId))!.daysLeft).toBe(2);
    await setEnds(-60_000);
    expect(await getClientTrial(admin, c.clientId)).toMatchObject({ daysLeft: 0, active: true });
  });

  it("CLIENT no puede activar ni convertir pruebas", async () => {
    const c = await makeClient();
    await expect(startClientTrial(clientActor(c.clientId), c.clientId, "publicaciones_gbp")).rejects.toMatchObject({ status: 403 });
    await expect(convertClientTrial(clientActor(c.clientId), c.clientId)).rejects.toMatchObject({ status: 403 });
  });

  it("concurrencia: dos activaciones simultáneas con distinta automatización → solo una prueba", async () => {
    const c = await makeClient();
    const results = await Promise.allSettled([
      startClientTrial(admin, c.clientId, "publicaciones_gbp"),
      startClientTrial(admin, c.clientId, "publicaciones"),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed[0].reason).toMatchObject({ status: 409, code: "TRIAL_ALREADY_USED" });
    expect(await prisma.clientAutomation.count({ where: { clientId: c.clientId, trialStartedAt: { not: null } } })).toBe(1);
    expect(await prisma.clientAutomation.count({ where: { clientId: c.clientId, enabled: true } })).toBe(1);
  });

  it("concurrencia: doble clic en la misma automatización → una sola prueba en BD", async () => {
    const c = await makeClient();
    const results = await Promise.allSettled([
      startClientTrial(admin, c.clientId, "publicaciones_gbp"),
      startClientTrial(admin, c.clientId, "publicaciones_gbp"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.clientAutomation.count({ where: { clientId: c.clientId, trialStartedAt: { not: null } } })).toBe(1);
  });

  it("si la automatización estuvo activa antes (fila apagada sin prueba) la prueba se activa igual", async () => {
    const c = await makeClient();
    await saveClientAutomations(admin, c.clientId, { publicaciones_gbp: true });
    await saveClientAutomations(admin, c.clientId, { publicaciones_gbp: false });
    await startClientTrial(admin, c.clientId, "publicaciones_gbp");
    expect(await getClientTrial(admin, c.clientId)).toMatchObject({ active: true, daysLeft: 7 });
    expect(await enabledKeys(c.clientId)).toEqual(["publicaciones_gbp"]);
  });

  it("concurrencia: doble clic con fila ya existente → una sola activación", async () => {
    const c = await makeClient();
    await saveClientAutomations(admin, c.clientId, { publicaciones_gbp: true });
    await saveClientAutomations(admin, c.clientId, { publicaciones_gbp: false });
    const results = await Promise.allSettled([
      startClientTrial(admin, c.clientId, "publicaciones_gbp"),
      startClientTrial(admin, c.clientId, "publicaciones_gbp"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r): r is PromiseRejectedResult => r.status === "rejected")!.reason).toMatchObject({ status: 409 });
  });
});
