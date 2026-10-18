import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { assertTestDatabase } from "../test-env";

/** Vacía todas las tablas de la BD de pruebas y vuelve a cargar el catálogo de automatizaciones. */
export async function resetDb() {
  assertTestDatabase(process.env.DATABASE_URL);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  await prisma.automationCatalog.createMany({
    data: [
      { automationKey: "web_whatsapp", name: "Editor web por WhatsApp", sortOrder: 10 },
      { automationKey: "publicaciones", name: "Publicaciones multicanal", sortOrder: 20 },
      { automationKey: "publicaciones_gbp", name: "Publicaciones en Google (GBP)", sortOrder: 15 },
      { automationKey: "resenas_gbp", name: "Respuesta automática a reseñas", sortOrder: 30 },
    ],
  });
}

let seq = 0;
/** Cliente de prueba con datos válidos y únicos. */
export async function makeClient(overrides: Partial<{ clientName: string; whatsappE164: string; active: boolean }> = {}) {
  seq += 1;
  return prisma.client.create({
    data: {
      clientName: overrides.clientName ?? `Cliente prueba ${seq} ${Date.now()}`,
      whatsappE164: overrides.whatsappE164 ?? `+3461${String(Date.now() + seq).slice(-7)}`,
      driveFolderId: "drive-folder-test-0001",
      googleSheetId: "sheet-id-test-000001",
      googleSheetTab: "Plantilla_Base",
      timezone: "Europe/Madrid",
      active: overrides.active ?? true,
    },
  });
}

export const admin: Actor = { id: "admin", email: "admin@test", name: "Admin", role: "ADMIN", clientId: null, gbpClientIds: [] };

export function clientActor(clientId: string, gbpClientIds: string[] = []): Actor {
  return { id: `client-${clientId}`, email: "cliente@test", name: "Cliente", role: "CLIENT", clientId, gbpClientIds };
}
