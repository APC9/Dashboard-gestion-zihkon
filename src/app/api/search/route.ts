import { z } from "zod";
import { parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { globalSearch } from "@/lib/data/search";

const querySchema = z.object({ q: z.string().trim().max(100).default("") });

export const GET = route(async (req) => {
  const actor = await requireActor();
  const { q } = parseParams(searchParamsObject(req), querySchema);
  return { results: await globalSearch(actor, q) };
});
