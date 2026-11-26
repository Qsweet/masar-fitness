import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // اختبارات التكامل (قاعدة حقيقية) لها إعدادها: vitest.integration.config.ts
    exclude: ["src/**/*.integration.test.ts"],
  },
});
