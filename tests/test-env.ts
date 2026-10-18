/**
 * Variables de entorno de PRUEBA (valores ficticios). Las comparten Vitest y Playwright.
 * La BD es el contenedor desechable zihkon-test-db; nunca la de desarrollo ni la de producción.
 */
export const TEST_DB_URL = "postgresql://test:test@localhost:5440/zihkon_test";
export const TEST_ADMIN_EMAIL = "admin@test.zihkon.local";
export const TEST_ADMIN_PASSWORD = "Prueba-Panel-2026!";

export const testEnv: Record<string, string> = {
  DATABASE_URL: TEST_DB_URL,
  NEXTAUTH_SECRET: "secreto-de-pruebas-solo-local-0123456789abcdef",
  ADMIN_EMAIL: TEST_ADMIN_EMAIL,
  // bcrypt de TEST_ADMIN_PASSWORD, en base64 para que el «$» no se interprete.
  ADMIN_PASSWORD_HASH: Buffer.from("$2b$10$u/Yqe84L7gk3fFZrK0wKvO7cYPe4OMcZRQ4IynbWh8S9vgkTqMaLS").toString("base64"),
  ADMIN_NAME: "Admin de pruebas",
  N8N_WEBHOOK_SECRET: "secreto-n8n-de-pruebas-0123456789",
  N8N_WEBHOOK_TIMEOUT_MS: "2000",
};

/** Impide ejecutar pruebas destructivas contra cualquier BD que no sea la de pruebas. */
export function assertTestDatabase(url: string | undefined) {
  if (!url || !/@localhost:5440\/zihkon_test$/.test(url)) {
    throw new Error(`Las pruebas solo pueden usar la BD aislada de pruebas (${TEST_DB_URL}). Recibido: ${url ?? "(vacío)"}`);
  }
}
