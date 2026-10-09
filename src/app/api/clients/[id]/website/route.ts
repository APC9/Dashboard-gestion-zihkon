import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { getClientWebsites, upsertClientWebsite } from "@/lib/data/websites";
import { uuidParam } from "@/lib/validation/common";
import { websiteUpsertSchema } from "@/lib/validation/website";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  return getClientWebsites(actor, id);
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const input = await parseBody(req, websiteUpsertSchema);
  const client = await getClient(actor, id);
  const site = await upsertClientWebsite(actor, id, input);
  await logActivity(actor, {
    action: input.websiteId ? "website.update" : "website.create",
    clientId: id,
    clientLabel: client.clientName,
    resourceType: "website",
    resourceId: site.websiteId,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: input.websiteId ? "Actualizó la configuración de la web" : "Añadió una web",
  });
  return site;
});
