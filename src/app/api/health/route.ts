import { prisma } from "@/lib/db";

/** Healthcheck público para Docker/Coolify. No expone ningún dato. */
export async function GET() {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  return Response.json(
    { status: database ? "ok" : "degraded", database },
    { status: database ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
