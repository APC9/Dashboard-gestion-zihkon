import { UpstreamError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { triggerGbpListAccounts } from "@/lib/n8n/triggers";
import { googleAccountsErrorSchema, googleAccountsSuccessSchema } from "@/lib/validation/gbp";

/**
 * Consulta en Google (vía n8n) las cuentas y fichas de Google Business Profile.
 * Solo administradores. triggerWorkflow registra la llamada en el log de actividad.
 * Cada item lleva `profile_id` si su location_id ya está dado de alta en gbp_clients.
 */
export const POST = route(async (req) => {
  const actor = await requireAdmin();
  const result = await triggerGbpListAccounts(actor, req);

  if (!result.ok) {
    const error = googleAccountsErrorSchema.safeParse(result.response);
    if (error.success) throw new UpstreamError(error.data.error);
    // 401/403 sin cuerpo JSON: lo devuelve el propio nodo Webhook cuando falla la Header Auth.
    if (result.status === 401 || result.status === 403) {
      throw new UpstreamError("n8n rechazó la autenticación del webhook: revisa la credencial Header Auth (X-Zihkon-Secret)");
    }
    throw new UpstreamError(`n8n respondió con estado ${result.status}`);
  }

  const parsed = googleAccountsSuccessSchema.safeParse(result.response);
  if (!parsed.success) {
    console.error("[gbp/accounts] Respuesta de n8n no válida", parsed.error.issues);
    throw new UpstreamError("La respuesta de n8n no tiene el formato esperado (ok, count, items)");
  }

  // Las cuentas sin fichas (location_id null) no se muestran.
  const locations = parsed.data.items.flatMap((i) => (i.location_id ? [{ ...i, location_id: i.location_id }] : []));
  const profiles = locations.length
    ? await prisma.gbpClient.findMany({
        where: { locationId: { in: locations.map((i) => i.location_id), mode: "insensitive" } },
        select: { id: true, locationId: true },
      })
    : [];
  const byLocation = new Map(profiles.map((p) => [p.locationId.toLowerCase(), p.id]));

  return {
    items: locations.map((item) => ({
      ...item,
      profile_id: byLocation.get(item.location_id.toLowerCase()) ?? null,
    })),
  };
});
