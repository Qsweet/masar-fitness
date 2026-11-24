import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export type Db = PrismaClient;

/** ينشئ عميل قاعدة البيانات. المستدعي يملك دورة حياته (`$disconnect`). */
export function createDb(connectionString: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** فحص حياة خفيف: هل القاعدة تجيب؟ لا يرمي؛ يُستعمل في نقطة الصحة. */
export async function isDbReachable(db: Db): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
