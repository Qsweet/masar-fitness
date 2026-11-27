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
 * يفرّغ جداول البيع وموظفي اللوحة كلها (TRUNCATE لا يشغّل triggers منع الحذف)، ثم يحذف كتالوج أندية
 * الاختبار وحدها.
 * الكتالوج والأندية الأخرى (ومنها البيانات التجريبية) لا تُمسّ.
 */
export async function resetCommerceTables(db: Db): Promise<void> {
  await assertTestDatabase(db);
  // C1 وC3 يمنعان TRUNCATE على الإصدارات وأصولها (ومنه التفريغ المتتالي من staff_users): قاعدة اختبار فقط
  await db.$executeRaw`ALTER TABLE content_releases DISABLE TRIGGER content_releases_forbid_truncate`;
  await db.$executeRaw`ALTER TABLE content_release_media DISABLE TRIGGER content_release_media_forbid_truncate`;
  await db.$executeRaw`
    TRUNCATE manual_payments, staff_recovery_codes, staff_sessions, staff_users, payment_incidents, payment_attempts, audit_logs, refunds, memberships, order_discounts, order_items, orders, assessment_requests,
      promotion_products, promotions, product_addons, customers, content_release_media, content_slides,
      content_slider_settings, media_assets, content_releases, content_draft_entries RESTART IDENTITY CASCADE`;
  await db.$executeRaw`ALTER TABLE content_releases ENABLE TRIGGER content_releases_forbid_truncate`;
  await db.$executeRaw`ALTER TABLE content_release_media ENABLE TRIGGER content_release_media_forbid_truncate`;
  const testClubs = { club: { slug: { startsWith: TEST_CLUB_SLUG_PREFIX } } };
  await db.productBenefit.deleteMany({ where: { version: { product: testClubs } } });
  await db.productVersion.deleteMany({ where: { product: testClubs } });
  await db.product.deleteMany({ where: testClubs });
  await db.club.deleteMany({ where: { slug: { startsWith: TEST_CLUB_SLUG_PREFIX } } });
}
