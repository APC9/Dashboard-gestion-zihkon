import { getRequestIp, logActivity } from "@/lib/activity-log";
import { ConflictError } from "@/lib/api/errors";
import { parseBody, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { automationAdminSchema } from "@/lib/validation/content";

/** Teléfonos autorizados a dar órdenes a las automatizaciones por WhatsApp. */
export const GET = route(async () => {
  await requireAdmin();
  return prisma.automationAdmin.findMany({ orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }] });
});

export const POST = route(async (req) => {
  const actor = await requireAdmin();
  const input = await parseBody(req, automationAdminSchema);
  const exists = await prisma.automationAdmin.findUnique({ where: { phoneE164: input.phoneE164 } });
  if (exists) throw new ConflictError("Ese teléfono ya está registrado");
  const created = await prisma.automationAdmin.create({ data: { phoneE164: input.phoneE164, active: input.active } });
  await logActivity(actor, {
    action: "automation_admin.create",
    resourceType: "automation_admin",
    resourceId: input.phoneE164,
    ip: getRequestIp(req),
    result: "SUCCESS",
    message: "Añadió un administrador de automatizaciones",
  });
  return Response.json(created, { status: 201 });
});
