import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { convertClientTrial, EXCLUSIVE_AUTOMATIONS, getClientTrial, startClientTrial } from "@/lib/data/automations";
import { triggerClientAutomationsNotify } from "@/lib/n8n/triggers";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), automationKey: z.enum(EXCLUSIVE_AUTOMATIONS).default("publicaciones_gbp") }).strict(),
  z.object({ action: z.literal("convert") }).strict(),
]);

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getClientTrial(actor, id);
});

/** Activa la prueba gratuita (y avisa al cliente) o la convierte en suscripción. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const body = await parseBody(req, bodySchema);

  if (body.action === "convert") {
    const { client } = await convertClientTrial(actor, id);
    await logActivity(actor, {
      action: "client.trial.convert",
      clientId: id,
      clientLabel: client.clientName,
      resourceType: "client_automation",
      resourceId: id,
      ip: getRequestIp(req),
      result: "SUCCESS",
      message: "Pasó la prueba gratuita a suscripción",
    });
    return { trial: await getClientTrial(actor, id), notify: { sent: false } };
  }

  const { client, automation } = await startClientTrial(actor, id, body.automationKey);
  await logActivity(actor, {
    action: "client.trial.start",
    clientId: id,
    clientLabel: client.clientName,
    resourceType: "client_automation",
    resourceId: body.automationKey,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: `Activó la prueba gratuita de "${automation.name}"`,
  });

  // La prueba ya está guardada: si el aviso falla se informa, pero no se deshace nada.
  let notify: { sent: boolean; error?: string } = { sent: false };
  try {
    const result = await triggerClientAutomationsNotify(actor, id, { activated: [body.automationKey], deactivated: [] }, req);
    notify = result.ok ? { sent: true } : { sent: false, error: result.message };
  } catch (error) {
    notify = { sent: false, error: error instanceof Error ? error.message : "No se pudo avisar al cliente" };
  }
  return { trial: await getClientTrial(actor, id), notify };
});
