import { parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { listReviews } from "@/lib/data/gbp";
import { reviewListQuerySchema } from "@/lib/validation/gbp";

export const GET = route(async (req) => {
  const actor = await requireActor();
  return listReviews(actor, parseParams(searchParamsObject(req), reviewListQuerySchema));
});
