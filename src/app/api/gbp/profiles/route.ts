import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { createGbpProfile, listGbpProfiles } from "@/lib/data/gbp";
import { gbpProfileFormSchema } from "@/lib/validation/gbp";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export const GET = route(async (req) => {
  const actor = await requireActor();
  return listGbpProfiles(actor, parseParams(searchParamsObject(req), querySchema));
});

export const POST = route(async (req) => {
  const actor = await requireAdmin();
  const input = await parseBody(req, gbpProfileFormSchema);
  const profile = await createGbpProfile(actor, input);
  await logActivity(actor, {
    action: "gbp.profile.create",
    clientId: profile.id,
    clientLabel: profile.client.clientName,
    resourceType: "gbp_profile",
    resourceId: String(profile.id),
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Creó un perfil de Google Business",
  });
  return Response.json(profile, { status: 201 });
});
