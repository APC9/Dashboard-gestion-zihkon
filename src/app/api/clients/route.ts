import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { createClient, listClients } from "@/lib/data/clients";
import { clientCreateSchema, clientListQuerySchema } from "@/lib/validation/client";

export const GET = route(async (req) => {
  const actor = await requireActor();
  const query = parseParams(searchParamsObject(req), clientListQuerySchema);
  return listClients(actor, query);
});

export const POST = route(async (req) => {
  const actor = await requireAdmin();
  const input = await parseBody(req, clientCreateSchema);
  const { client, gbpProfile } = await createClient(actor, input);
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
  if (gbpProfile) {
    await logActivity(actor, {
      action: "gbp.profile.create",
      clientId: String(gbpProfile.id),
      clientLabel: client.clientName,
      resourceType: "gbp_profile",
      resourceId: String(gbpProfile.id),
      ip: getRequestIp(req),
      result: "SUCCESS",
      message: "Creó un perfil de Google Business",
    });
  }
  return Response.json({ ...client, gbpProfileId: gbpProfile?.id ?? null }, { status: 201 });
});
