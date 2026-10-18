import { defineConfig } from "@playwright/test";
import { testEnv } from "./tests/test-env";

const PORT = 3300;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E contra `next dev` con la BD de pruebas aislada (Docker, puerto 5440) y un n8n simulado.
 * Las variables de proceso tienen prioridad sobre los ficheros .env, así que el panel
 * nunca usa la BD local real ni el n8n real durante estas pruebas.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    locale: "es-ES",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/mock-n8n-server.mjs",
      url: "http://127.0.0.1:5799/__health",
      reuseExistingServer: false,
      env: { MOCK_N8N_PORT: "5799" },
    },
    {
      command: `pnpm next dev -p ${PORT}`,
      url: `${BASE_URL}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...testEnv,
        NODE_ENV: "development",
        NEXTAUTH_URL: BASE_URL,
        NEXT_PUBLIC_APP_URL: BASE_URL,
        N8N_WEBHOOK_BASE_URL: "http://127.0.0.1:5799/webhook",
        N8N_API_URL: "",
        N8N_API_KEY: "",
        STRIPE_SECRET_KEY: "",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      },
    },
  ],
});
