import { defineConfig } from "prisma/config";

/**
 * `prisma generate` لا يحتاج اتصالًا، فنقبل غياب DATABASE_URL هنا؛
 * أوامر الترحيل تفشل برسالة Prisma الواضحة إن لم يُضبط.
 * SHADOW_DATABASE_URL اختياري: يلزم فقط لـ`prisma migrate diff --from-migrations`
 * (فحص أن الترحيلات تطابق schema.prisma، انظر docs/TESTING.md).
 */
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
    ...(shadowDatabaseUrl === undefined || shadowDatabaseUrl === "" ? {} : { shadowDatabaseUrl }),
  },
});
