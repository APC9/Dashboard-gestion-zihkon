import path from "node:path";
import { defineConfig } from "vitest/config";

// Pruebas unitarias e integración. La integración usa SOLO la BD aislada de pruebas
// (contenedor zihkon-test-db, puerto 5440); tests/setup-env.ts se niega a arrancar con otra.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // Los archivos de integración comparten la misma BD: se ejecutan de uno en uno.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
