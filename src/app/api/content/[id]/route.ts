import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getIntake, updateIntakeDescription } from "@/lib/data/content";
import { uuidParam } from "@/lib/validation/common";
import { contentDescriptionSchema } from "@/lib/validation/content";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getIntake(actor, id);
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const { description } = await parseBody(req, contentDescriptionSchema);
  const intake = await getIntake(actor, id);
  const updated = await updateIntakeDescription(actor, id, description);
  await logActivity(actor, {
    action: "content.edit_description",
    clientId: intake.clientId,
    clientLabel: intake.client?.clientName,
    resourceType: "content_intake",
    resourceId: id,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Editó la descripción del contenido",
  });
  return updated;
});
