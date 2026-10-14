import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { cancelIntake, getIntake } from "@/lib/data/content";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/** Cancelar = el contenido pasa a "failed" y su sesión de WhatsApp a CANCELLED (como CANCELAR en n8n). No se borra nada. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const intake = await getIntake(actor, id);
  const updated = await cancelIntake(actor, id);
  await logActivity(actor, {
    action: "content.cancel",
    clientId: intake.clientId,
    clientLabel: intake.client?.clientName,
    resourceType: "content_intake",
    resourceId: id,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Canceló un contenido",
  });
  return updated;
});
