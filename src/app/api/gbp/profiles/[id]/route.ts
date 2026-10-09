import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getGbpProfile, reviewSummary, updateGbpProfile } from "@/lib/data/gbp";
import { intParam } from "@/lib/validation/common";
import { gbpProfileUpdateSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const [profile, summary] = await Promise.all([getGbpProfile(actor, id), reviewSummary(actor, [id])]);
  return { profile, summary };
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, intParam);
  const input = await parseBody(req, gbpProfileUpdateSchema);
  const profile = await updateGbpProfile(actor, id, input);
  await logActivity(actor, {
    action: "gbp.profile.update",
    clientId: String(id),
    clientLabel: profile.businessName,
    resourceType: "gbp_profile",
    resourceId: String(id),
    ip: getRequestIp(req),
    result: "SUCCESS",
    message:
      Object.keys(input).length === 1 && input.active !== undefined
        ? input.active
          ? "Activó el perfil GBP"
          : "Desactivó el perfil GBP"
        : "Editó la configuración GBP",
  });
  return profile;
});
