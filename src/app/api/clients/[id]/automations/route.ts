import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { listClientAutomations, saveClientAutomations, setClientAutomation } from "@/lib/data/automations";
import { triggerClientAutomationsNotify } from "@/lib/n8n/triggers";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    automationKey: z.string().trim().min(1).max(64),
    enabled: z.boolean(),
  })
  .strict();

const saveSchema = z
  .object({
    automations: z.record(z.string().trim().min(1).max(64), z.boolean()),
  })
  .strict();

/** Guarda las automatizaciones del cliente y le avisa por WhatsApp de lo que ha cambiado. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const { automations } = await parseBody(req, saveSchema);
  const saved = await saveClientAutomations(actor, id, automations);
  const { client, activated, deactivated, activatedNames, deactivatedNames } = saved;

  if (activated.length || deactivated.length) {
    await logActivity(actor, {
      action: "client.automations.save",
      clientId: id,
      clientLabel: client.clientName,
      resourceType: "client_automation",
      resourceId: id,
      ip: getRequestIp(req),
      result: "SUCCESS",
      message: [
        activatedNames.length ? `Activó: ${activatedNames.join(", ")}` : null,
        deactivatedNames.length ? `Finalizó: ${deactivatedNames.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // Los cambios ya están guardados: si el aviso falla se informa, pero no se deshace nada.
  let notify: { sent: boolean; error?: string } = { sent: false };
  if (activated.length || deactivated.length) {
    try {
      const result = await triggerClientAutomationsNotify(actor, id, { activated, deactivated }, req);
      notify = result.ok ? { sent: true } : { sent: false, error: result.message };
    } catch (error) {
      notify = { sent: false, error: error instanceof Error ? error.message : "No se pudo avisar al cliente" };
    }
  }

  return { items: await listClientAutomations(actor, id), activated, deactivated, notify };
});

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return listClientAutomations(actor, id);
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const { automationKey, enabled } = await parseBody(req, updateSchema);
  const { client, automation } = await setClientAutomation(actor, id, automationKey, enabled);

  await logActivity(actor, {
    action: enabled ? "client.automation.enable" : "client.automation.disable",
    clientId: id,
    clientLabel: client.clientName,
    resourceType: "client_automation",
    resourceId: automationKey,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: `${enabled ? "Habilitó" : "Deshabilitó"} "${automation.name}"`,
  });
  return listClientAutomations(actor, id);
});
