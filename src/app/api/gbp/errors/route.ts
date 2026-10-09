import { z } from "zod";
import { parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireActor } from "@/lib/auth/session";
import { listGbpErrors } from "@/lib/data/gbp";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  gbpClientId: z.coerce.number().int().positive().optional(),
});

export const GET = route(async (req) => {
  const actor = await requireActor();
  return listGbpErrors(actor, parseParams(searchParamsObject(req), querySchema));
});
