import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    // قاعدة واحدة مشتركة: الملفات تُشغَّل بالتتابع حتى لا تتداخل البيانات
    fileParallelism: false,
  },
});
