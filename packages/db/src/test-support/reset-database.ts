import type { Db } from "../client";
import { TEST_CLUB_SLUG_PREFIX } from "./commerce-constants";

/** اسم قاعدة الاختبار ينتهي بهذه اللاحقة؛ أي قاعدة أخرى لا تُفرَّغ أبدًا. */
const TEST_DATABASE_SUFFIX = "_test";

export async function assertTestDatabase(db: Db): Promise<void> {
  const rows = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = rows[0]?.name ?? "";
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `resetCommerceTables يعمل على قاعدة اختبار فقط (*${TEST_DATABASE_SUFFIX})، لا «${name}»`,
    );
  }
}

/**
 * يفرّغ جداول البيع كلها (TRUNCATE لا يشغّل triggers منع الحذف)، ثم يحذف كتالوج أندية الاختبار وحدها.
 * الكتالوج والأندية الأخرى (ومنها البيانات التجريبية) لا تُمسّ.
 */
export async function resetCommerceTables(db: Db): Promise<void> {
  await assertTestDatabase(db);
  await db.$executeRaw`
    TRUNCATE payment_incidents, payment_attempts, audit_logs, refunds, memberships, order_discounts, order_items, orders, assessment_requests,
      promotion_products, promotions, product_addons, customers RESTART IDENTITY CASCADE`;
  const testClubs = { club: { slug: { startsWith: TEST_CLUB_SLUG_PREFIX } } };
  await db.productBenefit.deleteMany({ where: { version: { product: testClubs } } });
  await db.productVersion.deleteMany({ where: { product: testClubs } });
  await db.product.deleteMany({ where: testClubs });
  await db.club.deleteMany({ where: { slug: { startsWith: TEST_CLUB_SLUG_PREFIX } } });
}
