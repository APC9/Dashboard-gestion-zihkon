import { z } from "zod";
import { parseParams, route, searchParamsObject } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { listPayments, paymentsToCsv } from "@/lib/data/billing";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD"),
  format: z.enum(["csv", "json"]).default("csv"),
});

/** Cobros entre dos fechas (to incluida) para la gestoría. */
export const GET = route(async (req) => {
  const actor = await requireAdmin();
  const { from, to, format } = parseParams(searchParamsObject(req), querySchema);
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const rows = await listPayments(actor, new Date(`${from}T00:00:00Z`), end);
  if (format === "json") return rows;
  return new Response(paymentsToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cobros_${from}_${to}.csv"`,
      "cache-control": "no-store",
    },
  });
});
