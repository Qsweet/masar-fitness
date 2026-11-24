import "server-only";
import { createDb, type Db } from "@masar/db";
import { getEnv } from "./env";

// في وضع التطوير يعيد Next تحميل الوحدات مع كل تعديل؛ نحفظ العميل على globalThis كي لا تتراكم الاتصالات.
const globalForDb = globalThis as typeof globalThis & { masarDb?: Db };

export function getDb(): Db {
  globalForDb.masarDb ??= createDb(getEnv().DATABASE_URL);
  return globalForDb.masarDb;
}
