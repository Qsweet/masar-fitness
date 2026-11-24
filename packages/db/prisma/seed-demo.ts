/**
 * بيانات تجريبية للتطوير والمعاينة فقط: الأسعار والمدد هنا **ليست أسعار النادي**.
 * تُستبدل ببيانات المالك الحقيقية قبل أي إطلاق. يرفض العمل بلا SEED_DEMO_DATA=yes.
 *
 *   SEED_DEMO_DATA=yes DATABASE_URL=... pnpm --filter @masar/db seed:demo
 */
import { createDb } from "../src/client";

const CLUB_SLUG = "masar-al-abtal";
const VALID_FROM = new Date("2026-01-01T00:00:00+03:00");

const BENEFITS = [
  { labelAr: "صالة الحديد واللياقة", labelEn: "Strength and fitness floor" },
  { labelAr: "المسبح", labelEn: "Swimming pool" },
  { labelAr: "الجاكوزي", labelEn: "Jacuzzi" },
  { labelAr: "غرفة البخار", labelEn: "Steam room" },
];

const PLANS = [
  {
    slug: "one-month",
    nameAr: "الشهرية",
    nameEn: "Monthly",
    months: 1,
    bonus: 0,
    priceMinor: 35_000,
  },
  {
    slug: "three-months",
    nameAr: "ربع السنوية",
    nameEn: "Quarterly",
    months: 3,
    bonus: 0,
    priceMinor: 90_000,
  },
  {
    slug: "six-months",
    nameAr: "نصف السنوية",
    nameEn: "Half-year",
    months: 6,
    bonus: 0,
    priceMinor: 160_000,
  },
  {
    slug: "one-year",
    nameAr: "السنوية",
    nameEn: "Annual",
    months: 12,
    bonus: 2,
    priceMinor: 280_000,
  },
];

if (process.env.SEED_DEMO_DATA !== "yes") {
  throw new Error(
    "Refusing to seed demo data: set SEED_DEMO_DATA=yes (never on a production database).",
  );
}
const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error("DATABASE_URL is required.");
}

const db = createDb(url);
const club = await db.club.upsert({
  where: { slug: CLUB_SLUG },
  update: {},
  create: { slug: CLUB_SLUG, nameAr: "مسار الأبطال الرياضي", nameEn: "Masters Way Sports Club" },
});

for (const [index, plan] of PLANS.entries()) {
  const product = await db.product.upsert({
    where: { slug: plan.slug },
    update: { status: "active", sortOrder: index, nameAr: plan.nameAr, nameEn: plan.nameEn },
    create: {
      clubId: club.id,
      kind: "membership",
      slug: plan.slug,
      status: "active",
      sortOrder: index,
      nameAr: plan.nameAr,
      nameEn: plan.nameEn,
      summaryAr: "كل مرافق النادي في اشتراك واحد.",
      summaryEn: "Every club facility in one membership.",
    },
  });
  await db.productVersion.deleteMany({ where: { productId: product.id } });
  await db.productVersion.create({
    data: {
      productId: product.id,
      priceMinor: plan.priceMinor,
      durationMonths: plan.months,
      bonusMonths: plan.bonus,
      validFrom: VALID_FROM,
      benefits: { create: BENEFITS.map((benefit, sortOrder) => ({ ...benefit, sortOrder })) },
    },
  });
}

await db.$disconnect();
process.stdout.write(`Seeded ${String(PLANS.length)} demo plans for ${CLUB_SLUG}.\n`);
