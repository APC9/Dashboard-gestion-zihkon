import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { listClientAutomations, setClientAutomation } from "@/lib/data/automations";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    automationKey: z.string().trim().min(1).max(64),
    enabled: z.boolean(),
  })
  .strict();

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
