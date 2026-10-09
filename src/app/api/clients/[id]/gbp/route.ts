import { parseParams, route } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { findGbpLinks } from "@/lib/data/client-links";
import { getClient } from "@/lib/data/clients";
import { reviewSummary } from "@/lib/data/gbp";
import { prisma } from "@/lib/db";
import { uuidParam } from "@/lib/validation/common";

type Ctx = { params: Promise<{ id: string }> };

/** Perfiles GBP vinculados (por deducción) al cliente y resumen de reseñas. */
export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireActor();
  const { id } = parseParams(await ctx.params, uuidParam);
  const client = await getClient(actor, id);
  const links = await findGbpLinks(actor, client);
  const ids = links.map((l) => l.gbpClientId);
  const [profiles, summary] = await Promise.all([
    prisma.gbpClient.findMany({ where: { id: { in: ids } } }),
    reviewSummary(actor, ids),
  ]);
  return { links, profiles, summary };
});
