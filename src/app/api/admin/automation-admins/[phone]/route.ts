import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { NotFoundError } from "@/lib/api/errors";
import { parseBody, parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ phone: string }> };
const paramSchema = z.object({ phone: z.string().regex(/^\+?\d{7,15}$/, "Teléfono no válido") });
const bodySchema = z.object({ active: z.boolean() });

/** Solo activar/desactivar: no se eliminan registros. */
export const PATCH = route(async (req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { phone } = parseParams({ phone: decodeURIComponent((await ctx.params).phone) }, paramSchema);
  const { active } = await parseBody(req, bodySchema);
  const exists = await prisma.automationAdmin.findUnique({ where: { phoneE164: phone } });
  if (!exists) throw new NotFoundError("Teléfono no encontrado");
  const updated = await prisma.automationAdmin.update({ where: { phoneE164: phone }, data: { active } });
  await logActivity(actor, {
    action: active ? "automation_admin.activate" : "automation_admin.deactivate",
    resourceType: "automation_admin",
    resourceId: phone,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: active ? "Activó un administrador de automatizaciones" : "Desactivó un administrador de automatizaciones",
  });
  return updated;
});
