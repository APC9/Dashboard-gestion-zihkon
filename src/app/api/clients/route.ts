import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { createClient, listClients } from "@/lib/data/clients";
import { clientFormSchema, clientListQuerySchema } from "@/lib/validation/client";

export const GET = route(async (req) => {
  const actor = await requireActor();
  const query = parseParams(searchParamsObject(req), clientListQuerySchema);
  return listClients(actor, query);
});

export const POST = route(async (req) => {
  const actor = await requireAdmin();
  const input = await parseBody(req, clientFormSchema);
  const client = await createClient(actor, input);
  await logActivity(actor, {
    action: "client.create",
    clientId: client.clientId,
    clientLabel: client.clientName,
    resourceType: "client",
    resourceId: client.clientId,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Creó el cliente",
  });
  return Response.json(client, { status: 201 });
});
