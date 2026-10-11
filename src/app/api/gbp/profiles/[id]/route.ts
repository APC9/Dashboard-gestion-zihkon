import { getRequestIp, logActivity } from "@/lib/activity-log";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireActor, requireAdmin } from "@/lib/auth/session";
import { deleteGbpProfile, getGbpProfile, reviewSummary, updateGbpProfile } from "@/lib/data/gbp";
import { uuidParam } from "@/lib/validation/common";
import { gbpProfileUpdateSchema } from "@/lib/validation/gbp";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const [profile, summary] = await Promise.all([getGbpProfile(actor, id), reviewSummary(actor, [id])]);
  return { profile, summary };
});

export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const input = await parseBody(req, gbpProfileUpdateSchema);
  const profile = await updateGbpProfile(actor, id, input);
  await logActivity(actor, {
    action: "gbp.profile.update",
    clientId: id,
    clientLabel: profile.client.clientName,
    resourceType: "gbp_profile",
    resourceId: id,
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

export const DELETE = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, uuidParam);
  const profile = await deleteGbpProfile(actor, id);
  await logActivity(actor, {
    action: "gbp.profile.delete",
    clientId: id,
    clientLabel: profile.client.clientName,
    resourceType: "gbp_profile",
    resourceId: id,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Eliminó el perfil GBP",
  });
  return { ok: true };
});
