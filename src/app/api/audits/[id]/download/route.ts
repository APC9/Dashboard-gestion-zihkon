import { z } from "zod";
import { parseParams, route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { getAudit } from "@/lib/data/audits";

type Ctx = { params: Promise<{ id: string }> };
const paramSchema = z.object({ id: z.string().regex(/^\d{1,19}$/, "ID no válido") });

/** Descarga el informe + Google Places como JSON. El PDF se abre desde pdf_url. */
export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await requireAdmin();
  const { id } = parseParams(await ctx.params, paramSchema);
  const audit = await getAudit(actor, id);
  const slug = (audit.negocioClave ?? audit.nombreNegocio ?? `auditoria-${id}`)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .toLowerCase();
  const body = JSON.stringify(
    {
      id: audit.id,
      nombre_negocio: audit.nombreNegocio,
      email: audit.email,
      direccion: audit.direccion,
      created_at: audit.createdAt,
      pdf_url: audit.pdfUrl,
      informe: audit.informe,
      google_places: audit.googlePlaces,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="auditoria-${slug}.json"`,
      "cache-control": "no-store",
    },
  });
});
