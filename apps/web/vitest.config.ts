import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

function fromHere(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fromHere("./src"),
      "server-only": fromHere("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // اختبارات التكامل (قاعدة حقيقية) لها إعدادها: vitest.integration.config.ts
    exclude: ["src/**/*.integration.test.ts"],
  },
});
