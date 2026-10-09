import { parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { listIntakes } from "@/lib/data/content";
import { contentListQuerySchema } from "@/lib/validation/content";

export const GET = route(async (req) => {
  const actor = await requireActor();
  return listIntakes(actor, parseParams(searchParamsObject(req), contentListQuerySchema));
});
