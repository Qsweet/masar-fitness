import { defineConfig } from "prisma/config";

/**
 * `prisma generate` لا يحتاج اتصالًا، فنقبل غياب DATABASE_URL هنا؛
 * أوامر الترحيل تفشل برسالة Prisma الواضحة إن لم يُضبط.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
