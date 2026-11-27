import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

function fromHere(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

/** اختبارات التكامل في الويب (قاعدة حقيقية و`sharp` حقيقي): الملفات بالتتابع على القاعدة المشتركة. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fromHere("./src"),
      "server-only": fromHere("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
  },
});
