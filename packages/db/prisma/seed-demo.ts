/**
 * بيانات تجريبية للتطوير والمعاينة فقط: الأسعار والمدد والعروض والإضافة هنا **ليست بيانات النادي**،
 * وسياسات النادي المضبوطة هنا **ليست قرارات المالك**. تُستبدل ببيانات المالك الحقيقية قبل أي إطلاق.
 * يرفض العمل بلا SEED_DEMO_DATA=yes. تشغيله مرتين متتاليتين لا يغيّر شيئًا (النسخ لا تُحذف ولا تُعدَّل).
 *
 *   SEED_DEMO_DATA=yes DATABASE_URL=... pnpm --filter @masar/db seed:demo
 */
import { createDb, type Db } from "../src/client";
import type { Prisma } from "../src/generated/prisma/client";

const CLUB_SLUG = "masar-al-abtal";
const VALID_FROM = new Date("2026-01-01T00:00:00+03:00");
/**
 * نسخة ثانية بالسعر والمدة نفسيهما وأسماء المزايا الموحَّدة مع القاموس. قواعد سابقة فيها نسخة أولى
 * بالأسماء القديمة (ومزايا النسخة المباعة لا تُعدَّل)، والنسخة الحالية هي الأحدث بدايةً.
 */
const BENEFITS_UNIFIED_FROM = new Date("2026-11-01T00:00:00+03:00");
/** فترات النسخ المتتالية بلا تراكب (قيد product_versions_no_overlap): الأولى تُغلق عند بداية الثانية. */
const VERSION_PERIODS: readonly { validFrom: Date; validUntil: Date | null }[] = [
  { validFrom: VALID_FROM, validUntil: BENEFITS_UNIFIED_FROM },
  { validFrom: BENEFITS_UNIFIED_FROM, validUntil: null },
];

/** تجريبي، ليس قرار المالك: نسبة الضريبة النظامية الموثقة في docs/SECURITY.md (15%). */
const DEMO_VAT_RATE_BPS = 1500;
/** تجريبي، ليس قرار المالك: المهلة الحقيقية سؤال مفتوح للمالك. */
const DEMO_PAYMENT_WINDOW_MINUTES = 30;
/** تجريبي، ليس قرار المالك: قاعدة البدء الحقيقية سؤال مفتوح للمالك. */
const DEMO_START_RULE = "on_payment";
const DEMO_PERCENT_BPS = 1000;

/** أسماء المرافق كما في القاموس (facilities.items وfacilities.recovery.names) حرفيًا، حتى تطابق مزايا الاشتراك قسم المرافق. */
const BENEFITS = [
  { labelAr: "صالة الحديد", labelEn: "Strength floor" },
  { labelAr: "التمارين الوظيفية", labelEn: "Functional training" },
  { labelAr: "المسبح", labelEn: "Pool" },
  { labelAr: "الجاكوزي", labelEn: "Jacuzzi" },
  { labelAr: "البخار", labelEn: "Steam room" },
];

interface DemoProduct {
  slug: string;
  nameAr: string;
  nameEn: string;
  months: number | null;
  bonus: number;
  priceMinor: number;
}

/** أسماء الاشتراكات التجريبية بمدتها مكتوبة، بنمط واحد في اللغتين (تُحدَّث في كل تشغيل). */
const PLANS: DemoProduct[] = [
  {
    slug: "one-month",
    nameAr: "شهر واحد",
    nameEn: "1 month",
    months: 1,
    bonus: 0,
    priceMinor: 35_000,
  },
  {
    slug: "three-months",
    nameAr: "ثلاثة أشهر",
    nameEn: "3 months",
    months: 3,
    bonus: 0,
    priceMinor: 90_000,
  },
  {
    slug: "six-months",
    nameAr: "ستة أشهر",
    nameEn: "6 months",
    months: 6,
    bonus: 0,
    priceMinor: 160_000,
  },
  {
    slug: "one-year",
    nameAr: "سنة كاملة",
    nameEn: "12 months",
    months: 12,
    bonus: 2,
    priceMinor: 280_000,
  },
];

/** إضافة تجريبية واحدة لاختبار الآلية، مربوطة بكل الباقات. ليست منتجًا للنادي. */
const DEMO_ADDON: DemoProduct = {
  slug: "demo-addon",
  nameAr: "إضافة تجريبية",
  nameEn: "Demo add-on",
  months: null,
  bonus: 0,
  priceMinor: 5_000,
};

if (process.env.SEED_DEMO_DATA !== "yes") {
  throw new Error(
    "Refusing to seed demo data: set SEED_DEMO_DATA=yes (never on a production database).",
  );
}
const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error("DATABASE_URL is required.");
}

async function upsertClub(db: Db): Promise<string> {
  const policy = {
    vatRateBps: DEMO_VAT_RATE_BPS,
    orderPaymentWindowMinutes: DEMO_PAYMENT_WINDOW_MINUTES,
    membershipStartRule: DEMO_START_RULE,
  } as const;
  const club = await db.club.upsert({
    where: { slug: CLUB_SLUG },
    update: policy,
    create: {
      slug: CLUB_SLUG,
      nameAr: "مسار الأبطال الرياضي",
      nameEn: "Masters Way Sports Club",
      ...policy,
    },
  });
  return club.id;
}

/**
 * النسخة لا تُحذف ولا يُعدَّل سعرها ولا مدتها ولا مزاياها (قد تكون مباعة، والقاعدة تمنع ذلك):
 * تُنشأ إن لم توجد نسخة بالبداية نفسها، وإلا تُضبط نهايتها فقط (مسموحة لإغلاق نسخة قديمة).
 */
async function ensureVersion(
  db: Db,
  productId: string,
  item: DemoProduct,
  period: (typeof VERSION_PERIODS)[number],
): Promise<void> {
  const { validFrom, validUntil } = period;
  const existing = await db.productVersion.findFirst({ where: { productId, validFrom } });
  if (existing !== null) {
    if (existing.validUntil?.getTime() !== validUntil?.getTime()) {
      await db.productVersion.update({ where: { id: existing.id }, data: { validUntil } });
    }
    return;
  }
  const benefits = item.months === null ? BENEFITS.slice(0, 1) : BENEFITS;
  await db.productVersion.create({
    data: {
      productId,
      priceMinor: item.priceMinor,
      durationMonths: item.months,
      bonusMonths: item.bonus,
      validFrom,
      validUntil,
      benefits: { create: benefits.map((benefit, sortOrder) => ({ ...benefit, sortOrder })) },
    },
  });
}

async function upsertProduct(
  db: Db,
  clubId: string,
  kind: "membership" | "addon",
  item: DemoProduct,
  sortOrder: number,
): Promise<string> {
  const names = { status: "active", sortOrder, nameAr: item.nameAr, nameEn: item.nameEn } as const;
  const product = await db.product.upsert({
    where: { slug: item.slug },
    update: names,
    create: {
      clubId,
      kind,
      slug: item.slug,
      ...names,
      summaryAr: kind === "addon" ? "للتجربة فقط." : "كل مرافق النادي في اشتراك واحد.",
      summaryEn: kind === "addon" ? "For testing only." : "Every club facility in one membership.",
    },
  });
  for (const period of VERSION_PERIODS) {
    await ensureVersion(db, product.id, item, period);
  }
  return product.id;
}

async function linkAddon(db: Db, addonId: string, planIds: string[]): Promise<void> {
  for (const membershipProductId of planIds) {
    await db.productAddon.upsert({
      where: {
        membershipProductId_addonProductId: { membershipProductId, addonProductId: addonId },
      },
      update: {},
      create: { membershipProductId, addonProductId: addonId },
    });
  }
}

/** كوبونان تجريبيان: DEMO10 بلا حد، و DEMOONCE بحد استخدام واحد لاختبارات المتصفح. */
async function upsertDemoCoupons(db: Db, clubId: string): Promise<void> {
  const coupons: { code: string; nameAr: string; nameEn: string; maxRedemptions: number | null }[] =
    [
      { code: "DEMO10", nameAr: "كوبون تجريبي", nameEn: "Demo coupon", maxRedemptions: null },
      {
        code: "DEMOONCE",
        nameAr: "كوبون تجريبي لمرة",
        nameEn: "Demo single-use",
        maxRedemptions: 1,
      },
    ];
  for (const { code, ...coupon } of coupons) {
    const data = {
      ...coupon,
      status: "active",
      discountKind: "percentage",
      percentBps: DEMO_PERCENT_BPS,
      audience: "anyone",
      scope: "all_products",
      startsAt: VALID_FROM,
    } satisfies Omit<Prisma.PromotionUncheckedCreateInput, "clubId">;
    await db.promotion.upsert({
      where: { clubId_code: { clubId, code } },
      update: data,
      create: { clubId, code, ...data },
    });
  }
}

const db = createDb(url);
const clubId = await upsertClub(db);
const planIds: string[] = [];
for (const [index, plan] of PLANS.entries()) {
  planIds.push(await upsertProduct(db, clubId, "membership", plan, index));
}
const addonId = await upsertProduct(db, clubId, "addon", DEMO_ADDON, 0);
await linkAddon(db, addonId, planIds);
await upsertDemoCoupons(db, clubId);

await db.$disconnect();
process.stdout.write(
  `Seeded ${String(PLANS.length)} demo plans, 1 add-on, 2 coupons for ${CLUB_SLUG}.\n`,
);
