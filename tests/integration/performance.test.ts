import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { saveClientAutomations } from "@/lib/data/automations";
import { listClients } from "@/lib/data/clients";
import { clientListQuerySchema } from "@/lib/validation/client";
import { admin, resetDb } from "../helpers/db";

/**
 * Rendimiento orientativo con la BD de pruebas local (no es un test de carga).
 * Umbrales holgados: detectan regresiones graves (N+1, consultas sin índice), no microsegundos.
 */
const N = 1000;

beforeAll(async () => {
  await resetDb();
  await prisma.client.createMany({
    data: Array.from({ length: N }, (_, i) => ({
      clientName: `Cliente carga ${i}`,
      whatsappE164: `+3462${String(i).padStart(7, "0")}`,
      driveFolderId: "drive-folder-test-0001",
      googleSheetId: "sheet-id-test-000001",
      googleSheetTab: "Plantilla_Base",
      timezone: "Europe/Madrid",
      active: i % 3 !== 0,
    })),
  });
  const ids = await prisma.client.findMany({ select: { clientId: true }, take: 300 });
  await prisma.contentIntake.createMany({
    data: ids.map((c, i) => ({ clientId: c.clientId, sourceMessageId: `msg-${i}`, status: i % 2 ? "awaiting_description" : "processed" })),
  });
}, 60_000);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const time = async <T>(fn: () => Promise<T>) => {
  const t = performance.now();
  const r = await fn();
  return { r, ms: performance.now() - t };
};

describe("rendimiento", () => {
  it(`listClients con ${N} clientes: página y búsqueda en < 1,5 s`, async () => {
    await listClients(admin, clientListQuerySchema.parse({})); // calentamiento
    const page = await time(() => listClients(admin, clientListQuerySchema.parse({ page: 3, pageSize: 25 })));
    const search = await time(() => listClients(admin, clientListQuerySchema.parse({ q: "620000012" })));
    console.info(`[perf] listClients página: ${page.ms.toFixed(0)} ms · búsqueda: ${search.ms.toFixed(0)} ms`);
    expect(page.r.total).toBe(N);
    expect(page.r.items).toHaveLength(25);
    expect(search.r.total).toBeGreaterThanOrEqual(1);
    expect(page.ms).toBeLessThan(1500);
    expect(search.ms).toBeLessThan(1500);
  });

  it("50 guardados de automatizaciones en paralelo (clientes distintos) sin errores ni bloqueos", async () => {
    const ids = (await prisma.client.findMany({ select: { clientId: true }, take: 50, orderBy: { clientName: "asc" } })).map((c) => c.clientId);
    const { r, ms } = await time(() =>
      Promise.allSettled(ids.map((id) => saveClientAutomations(admin, id, { web_whatsapp: true, resenas_gbp: true }))),
    );
    console.info(`[perf] 50 guardados en paralelo: ${ms.toFixed(0)} ms`);
    expect(r.filter((x) => x.status === "rejected")).toEqual([]);
    expect(await prisma.clientAutomation.count({ where: { enabled: true } })).toBe(100);
    expect(ms).toBeLessThan(10_000);
  });
});
