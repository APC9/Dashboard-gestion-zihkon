import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { deleteClient, getClient, getClientOverview, setClientActive, updateClient } from "@/lib/data/clients";
import { clientUpdateSchema } from "@/lib/validation/client";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getClientOverview(actor, id);
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const input = await parseBody(req, clientUpdateSchema);

  // Cambiar el estado activo es una acción de administración.
  const { active, ...rest } = input;
  let client = await getClient(actor, id);
  if (Object.keys(rest).length) client = await updateClient(actor, id, rest);
  if (active !== undefined) {
    await requireAdmin();
    client = await setClientActive(actor, id, active);
  }

  await logActivity(actor, {
    action: active !== undefined && !Object.keys(rest).length ? (active ? "client.activate" : "client.deactivate") : "client.update",
    clientId: id,
    clientLabel: client.clientName,
    resourceType: "client",
    resourceId: id,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: active === undefined ? "Editó los datos del cliente" : active ? "Activó el cliente" : "Desactivó el cliente",
  });
  return client;
});

export const DELETE = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const client = await getClient(actor, id);
  await deleteClient(actor, id);
  await logActivity(actor, {
    action: "client.delete",
    clientId: id,
    clientLabel: client.clientName,
    resourceType: "client",
    resourceId: id,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Eliminó el cliente",
  });
  return { ok: true };
});
