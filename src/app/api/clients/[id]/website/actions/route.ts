import { NotFoundError } from "@/lib/api/errors";
import { parseBody, parseParams, route, ValidationError } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getWebsite } from "@/lib/data/websites";
import { triggerWebsiteChange, triggerWebsitePreview, triggerWebsitePublish } from "@/lib/n8n/triggers";
import { uuidParam } from "@/lib/validation/common";
import { websiteActionSchema } from "@/lib/validation/website";

type Ctx = { params: Promise<{ id: string }> };

/** Acciones de web delegadas a n8n: cambio con IA, preview y publicación. */
export const POST = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const input = await parseBody(req, websiteActionSchema);

  const site = await getWebsite(actor, input.websiteId);
  if (site.clientId !== id) throw new NotFoundError("Web no encontrada para este cliente");

  switch (input.action) {
    case "change":
      if (!input.instructions || input.instructions.length < 10) {
        throw new ValidationError({ instructions: ["Describe el cambio con al menos 10 caracteres"] });
      }
      return triggerWebsiteChange(actor, site.websiteId, input.instructions, req);
    case "preview":
      return triggerWebsitePreview(actor, site.websiteId, req);
    case "publish":
      return triggerWebsitePublish(actor, site.websiteId, req);
  }
});
