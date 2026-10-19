import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/data/clients";
import { getClientReferrals, updateReferral } from "@/lib/data/referrals";
import { clientCreateSchema } from "@/lib/validation/client";
import { admin, clientActor, makeClient, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

let n = 0;
const input = (over: Record<string, unknown> = {}) => {
  n += 1;
  return clientCreateSchema.parse({ clientName: `Referido ${n}`, whatsappE164: `+3465000${String(n).padStart(4, "0")}`, metricoolBlogId: "", email: "", timezone: "", active: true, ...over });
};

describe("código de referido", () => {
  it("cada cliente nuevo recibe un código único ZK + 5 caracteres, sin caracteres confusos", async () => {
    const clientes = await Promise.all(Array.from({ length: 25 }, () => makeClient()));
    const codigos = clientes.map((c) => c.referralCode);
    expect(new Set(codigos).size).toBe(25);
    for (const c of codigos) expect(c).toMatch(/^ZK[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
  });

  it("alta con código (en minúsculas) enlaza al dueño y crea el referido PENDING", async () => {
    const dueño = await makeClient();
    const { client } = await createClient(admin, input({ referralCode: dueño.referralCode.toLowerCase() }));
    expect(client.referredByClientId).toBe(dueño.clientId);
    const info = await getClientReferrals(admin, dueño.clientId);
    expect(info.referrals).toHaveLength(1);
    expect(info.referrals[0]).toMatchObject({ referredClientId: client.clientId, status: "PENDING" });
    const delReferido = await getClientReferrals(admin, client.clientId);
    expect(delReferido.referredBy).toMatchObject({ clientId: dueño.clientId, status: "PENDING" });
  });

  it("código inexistente → 400 en el campo y no se crea el cliente", async () => {
    await expect(createClient(admin, input({ referralCode: "ZK99999" }))).rejects.toMatchObject({ status: 400, issues: { referralCode: [expect.stringContaining("No existe")] } });
    expect(await prisma.client.count()).toBe(0);
  });

  it("formato de código y email se validan en el formulario", () => {
    expect(() => input({ referralCode: "ABC" })).toThrow();
    expect(input({ referralCode: "zk4upr7" }).referralCode).toBe("ZK4UPR7");
    expect(() => input({ email: "no-es-email" })).toThrow();
    expect(input({ email: " bar@sol.es " }).email).toBe("bar@sol.es");
  });

  it("la BD rechaza emails mal formados aunque no pasen por el panel", async () => {
    const c = await makeClient();
    await expect(prisma.client.update({ where: { clientId: c.clientId }, data: { email: "mal" } })).rejects.toThrow();
  });
});

describe("mes gratis por referido", () => {
  async function conReferido() {
    const dueño = await makeClient();
    await prisma.clientAutomation.create({ data: { clientId: dueño.clientId, automationKey: "publicaciones", enabled: true } });
    const { client } = await createClient(admin, input({ referralCode: dueño.referralCode }));
    const id = BigInt((await getClientReferrals(admin, dueño.clientId)).referrals[0].referralId);
    return { dueño, referido: client, id };
  }

  it("2.º mes pagado → mes gratis ganado con el plan actual del dueño; después, aplicado", async () => {
    const { dueño, id } = await conReferido();
    const ganado = await updateReferral(admin, dueño.clientId, id, "second_payment");
    expect(ganado.status).toBe("EARNED");
    expect(ganado.rewardPlan).toEqual(["publicaciones"]);
    expect(ganado.secondPaymentAt).not.toBeNull();
    expect((await getClientReferrals(admin, dueño.clientId)).pendingFreeMonths).toBe(1);
    const aplicado = await updateReferral(admin, dueño.clientId, id, "applied");
    expect(aplicado.status).toBe("APPLIED");
    expect((await getClientReferrals(admin, dueño.clientId)).pendingFreeMonths).toBe(0);
  });

  it("no se puede aplicar sin 2.º pago, ni repetir, ni tocar un cancelado (409)", async () => {
    const { dueño, id } = await conReferido();
    await expect(updateReferral(admin, dueño.clientId, id, "applied")).rejects.toMatchObject({ status: 409 });
    await updateReferral(admin, dueño.clientId, id, "cancel");
    await expect(updateReferral(admin, dueño.clientId, id, "second_payment")).rejects.toMatchObject({ status: 409 });
  });

  it("doble clic en «2.º mes pagado» → solo uno cuenta", async () => {
    const { dueño, id } = await conReferido();
    const r = await Promise.allSettled([updateReferral(admin, dueño.clientId, id, "second_payment"), updateReferral(admin, dueño.clientId, id, "second_payment")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("un referido de otro cliente no se puede tocar desde este (404)", async () => {
    const { id } = await conReferido();
    const otro = await makeClient();
    await expect(updateReferral(admin, otro.clientId, id, "second_payment")).rejects.toMatchObject({ status: 404 });
  });

  it("un cliente se refiere una sola vez y nunca a sí mismo (restricciones de la BD)", async () => {
    const { dueño, referido } = await conReferido();
    const tercero = await makeClient();
    await expect(prisma.clientReferral.create({ data: { referrerClientId: tercero.clientId, referredClientId: referido.clientId, codeUsed: tercero.referralCode } })).rejects.toThrow();
    await expect(prisma.clientReferral.create({ data: { referrerClientId: dueño.clientId, referredClientId: dueño.clientId, codeUsed: dueño.referralCode } })).rejects.toThrow();
  });

  it("CLIENT: ve sus referidos pero no los de otros, y no puede marcar pagos (403)", async () => {
    const { dueño, id } = await conReferido();
    const otro = await makeClient();
    await expect(getClientReferrals(clientActor(dueño.clientId), dueño.clientId)).resolves.toMatchObject({ referralCode: dueño.referralCode });
    await expect(getClientReferrals(clientActor(otro.clientId), dueño.clientId)).rejects.toMatchObject({ status: 403 });
    await expect(updateReferral(clientActor(dueño.clientId), dueño.clientId, id, "second_payment")).rejects.toMatchObject({ status: 403 });
  });
});
