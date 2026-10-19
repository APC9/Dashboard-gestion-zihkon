import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient, getClient, listClients, setClientActive, updateClient } from "@/lib/data/clients";
import { clientCreateSchema, clientListQuerySchema } from "@/lib/validation/client";
import { admin, clientActor, makeClient, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const input = (over: Record<string, unknown> = {}) =>
  clientCreateSchema.parse({
    clientName: "Bar Prueba",
    whatsappE164: "+34600111222",
    metricoolBlogId: "",
    timezone: "",
    active: true,
    ...over,
  });
const q = (over: Record<string, unknown> = {}) => clientListQuerySchema.parse(over);

describe("alta de clientes", () => {
  it("crea el cliente con valores por defecto", async () => {
    const { client, gbpProfile } = await createClient(admin, input());
    expect(client).toMatchObject({ clientName: "Bar Prueba", whatsappE164: "+34600111222", metricoolBlogId: null, timezone: "Europe/Madrid" });
    expect(gbpProfile).toBeNull();
  });

  it("guarda la marca de Metricool del cliente", async () => {
    const { client } = await createClient(admin, input({ metricoolBlogId: "5362957" }));
    expect(client.metricoolBlogId).toBe("5362957");
    const updated = await updateClient(admin, client.clientId, { metricoolBlogId: "1234567" });
    expect(updated.metricoolBlogId).toBe("1234567");
  });

  it("WhatsApp duplicado → 409 aunque cambie el formato (+ o espacios)", async () => {
    await createClient(admin, input());
    await expect(createClient(admin, input({ clientName: "Otro", whatsappE164: "34600111222" }))).rejects.toMatchObject({ status: 409 });
    await expect(createClient(admin, input({ clientName: "Otro", whatsappE164: "+34 600 111 222" }))).rejects.toMatchObject({ status: 409 });
  });

  it("nombre duplicado (sin distinguir mayúsculas) → 409", async () => {
    await createClient(admin, input());
    await expect(createClient(admin, input({ clientName: "  bar PRUEBA ", whatsappE164: "+34600111333" }))).rejects.toMatchObject({ status: 409 });
  });

  it("un CLIENT no puede crear clientes", async () => {
    await expect(createClient(clientActor("11111111-1111-1111-1111-111111111111"), input())).rejects.toMatchObject({ status: 403 });
    expect(await prisma.client.count()).toBe(0);
  });

  it("concurrencia: dos altas simultáneas con el mismo WhatsApp → solo una", async () => {
    const results = await Promise.allSettled([
      createClient(admin, input({ clientName: "Uno" })),
      createClient(admin, input({ clientName: "Dos" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.client.count()).toBe(1);
  });

  it("concurrencia: mismo WhatsApp con y sin «+» a la vez → solo una", async () => {
    const results = await Promise.allSettled([
      createClient(admin, input({ clientName: "Uno", whatsappE164: "+34600111222" })),
      createClient(admin, input({ clientName: "Dos", whatsappE164: "34600111222" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.client.count()).toBe(1);
  });

  it("actualizar a un WhatsApp de otro cliente → 409", async () => {
    const a = await makeClient({ whatsappE164: "+34600000001" });
    const b = await makeClient({ whatsappE164: "+34600000002" });
    await expect(updateClient(admin, b.clientId, { whatsappE164: "34600000001" })).rejects.toMatchObject({ status: 409 });
    await expect(updateClient(admin, a.clientId, { whatsappE164: "+34600000001" })).resolves.toBeTruthy();
  });
});

describe("aislamiento de datos entre clientes", () => {
  it("listClients: un CLIENT solo ve su propio cliente", async () => {
    const [a] = [await makeClient(), await makeClient(), await makeClient()];
    expect((await listClients(admin, q())).total).toBe(3);
    const own = await listClients(clientActor(a.clientId), q());
    expect(own.total).toBe(1);
    expect(own.items[0].clientId).toBe(a.clientId);
  });

  it("listClients: un CLIENT sin client_id no ve nada", async () => {
    await makeClient();
    const actor = { ...clientActor("x"), clientId: null };
    expect((await listClients(actor, q())).total).toBe(0);
  });

  it("getClient/updateClient de otro cliente → 403 y sin cambios", async () => {
    const [a, b] = [await makeClient(), await makeClient()];
    await expect(getClient(clientActor(a.clientId), b.clientId)).rejects.toMatchObject({ status: 403 });
    await expect(updateClient(clientActor(a.clientId), b.clientId, { clientName: "Hackeado" })).rejects.toMatchObject({ status: 403 });
    expect((await prisma.client.findUnique({ where: { clientId: b.clientId } }))!.clientName).toBe(b.clientName);
  });

  it("activar/desactivar y borrar es solo para administradores", async () => {
    const a = await makeClient();
    await expect(setClientActive(clientActor(a.clientId), a.clientId, false)).rejects.toMatchObject({ status: 403 });
    await expect(deleteClient(clientActor(a.clientId), a.clientId)).rejects.toMatchObject({ status: 403 });
    expect(await prisma.client.count()).toBe(1);
  });
});

describe("listado y borrado", () => {
  it("busca por nombre y por cifras del teléfono; filtra por estado", async () => {
    await makeClient({ clientName: "Pizzería Sol", whatsappE164: "+34611222333" });
    await makeClient({ clientName: "Bar Luna", whatsappE164: "+34699888777", active: false });
    expect((await listClients(admin, q({ q: "sol" }))).items.map((c) => c.clientName)).toEqual(["Pizzería Sol"]);
    expect((await listClients(admin, q({ q: "699 888" }))).items.map((c) => c.clientName)).toEqual(["Bar Luna"]);
    expect((await listClients(admin, q({ status: "inactive" }))).total).toBe(1);
  });

  it("borra un cliente sin datos; con automatizaciones el FK impide el borrado (409/P2003)", async () => {
    const a = await makeClient();
    await deleteClient(admin, a.clientId);
    expect(await prisma.client.count()).toBe(0);
    await expect(deleteClient(admin, a.clientId)).rejects.toMatchObject({ status: 404 });
  });
});
