import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { gbpProfileName, getBacklogInfo, setBacklogAction } from "@/lib/data/gbp";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getBacklogInfo(actor, id);
});

/** { action: "start" } inicia la puesta al día (PENDING); { action: "stop" } la detiene (LIVE). */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const { action } = await parseBody(req, z.object({ action: z.enum(["start", "stop"]) }).strict());
  const { profile, info } = await setBacklogAction(actor, id, action);
  await logActivity(actor, {
    action: action === "start" ? "gbp.backlog.start" : "gbp.backlog.stop",
    clientId: profile.clientId,
    clientLabel: gbpProfileName(profile),
    resourceType: "gbp_client",
    resourceId: id,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: action === "start" ? "Inició la puesta al día de reseñas antiguas" : "Detuvo la puesta al día de reseñas antiguas",
  });
  return info;
});
