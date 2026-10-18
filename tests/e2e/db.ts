import pg from "pg";
import { assertTestDatabase, TEST_DB_URL } from "../test-env";

/** Acceso directo a la BD de pruebas desde los E2E (sin Prisma: `server-only` no se puede importar aquí). */
export async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  assertTestDatabase(TEST_DB_URL);
  const db = new pg.Client({ connectionString: TEST_DB_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export async function resetDb() {
  await withDb(async (db) => {
    const { rows } = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    await db.query(`TRUNCATE ${rows.map((r) => `"public"."${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    await db.query(`INSERT INTO public.automation_catalog (automation_key, name, sort_order) VALUES
      ('web_whatsapp', 'Editor web por WhatsApp', 10),
      ('publicaciones_gbp', 'Publicaciones en Google (GBP)', 15),
      ('publicaciones', 'Publicaciones multicanal', 20),
      ('resenas_gbp', 'Respuesta automática a reseñas', 30)`);
  });
}

export async function insertClient(name: string, phone: string) {
  return withDb(async (db) => {
    const { rows } = await db.query<{ client_id: string }>(
      `INSERT INTO public.clients (client_name, whatsapp_e164, drive_folder_id, google_sheet_id, google_sheet_tab, timezone, active)
       VALUES ($1, $2, 'drive-folder-test-0001', 'sheet-id-test-000001', 'Plantilla_Base', 'Europe/Madrid', true) RETURNING client_id`,
      [name, phone],
    );
    return rows[0].client_id;
  });
}

export const MOCK_N8N = "http://127.0.0.1:5799";

export async function n8nCalls(): Promise<{ path: string; body: Record<string, unknown> }[]> {
  return (await fetch(`${MOCK_N8N}/__calls`)).json();
}

export async function resetN8nCalls() {
  await fetch(`${MOCK_N8N}/__reset`, { method: "POST" });
}
