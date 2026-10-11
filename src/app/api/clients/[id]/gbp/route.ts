import { parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { reviewSummary } from "@/lib/data/gbp";
import { prisma } from "@/lib/db";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/** Perfiles GBP enlazados al cliente (gbp_clients.client_id) y resumen de reseñas. */
export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  await getClient(actor, id);
  const profiles = await prisma.gbpClient.findMany({ where: { clientId: id }, orderBy: { createdAt: "asc" } });
  const summary = await reviewSummary(actor, profiles.map((p) => p.id));
  return { profiles, summary };
});
