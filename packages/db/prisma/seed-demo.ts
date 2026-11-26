/**
 * بيانات المعاينة للتطوير والاختبار فقط. الاشتراكات الثلاثة **أسعار النادي الحالية مؤقتًا** كما يعرضها
 * موقعه اليوم (docs/CLUB_FACTS.md §4.1، قراءة 2026-11-25)، معروضة للمراجعة لا نهائية: تُؤكَّد من المالك
 * قبل أي إطلاق. اشتراك «4 أشهر» (799) لا يُضاف لأنه يناقض «3 أشهر + شهر مجانًا» بالمدة نفسها، ولا اشتراك
 * شهر واحد لأنه غير معروض في الموقع. الإضافة والكوبونان وسياسات النادي هنا **تجريبية لاختبار الآلية**.
 * يرفض العمل بلا SEED_DEMO_DATA=yes. تشغيله مرتين متتاليتين لا يغيّر شيئًا (النسخ لا تُحذف ولا تُعدَّل).
 *
 *   SEED_DEMO_DATA=yes DATABASE_URL=... pnpm --filter @masar/db seed:demo
 */
import { createDb, type Db } from "../src/client";
import type { Prisma } from "../src/generated/prisma/client";

const CLUB_SLUG = "masar-al-abtal";
const VALID_FROM = new Date("2026-01-01T00:00:00+03:00");
/** بداية النسخة الثانية من البيانات التجريبية القديمة (أسماء المزايا الموحَّدة). */
const BENEFITS_UNIFIED_FROM = new Date("2026-11-01T00:00:00+03:00");
/** بداية نسخ الأسعار الحقيقية المؤقتة: تاريخ قراءة موقع النادي. */
const CLUB_PRICES_FROM = new Date("2026-11-25T00:00:00+03:00");

/**
 * نسخ البيانات التجريبية القديمة (أسعار وهمية) في قواعد بُذرت قبل الأسعار الحقيقية: لا تُحذف (قد تكون مباعة)،
 * بل تُغلق عند بداية تاليتها فلا تتراكب (قيد product_versions_no_overlap). لا تُنشأ في قاعدة جديدة.
 */
const LEGACY_PERIODS: readonly { validFrom: Date; validUntil: Date }[] = [
  { validFrom: VALID_FROM, validUntil: BENEFITS_UNIFIED_FROM },
  { validFrom: BENEFITS_UNIFIED_FROM, validUntil: CLUB_PRICES_FROM },
];

/** تجريبي، ليس قرار المالك: نسبة الضريبة النظامية الموثقة في docs/SECURITY.md (15%). */
const DEMO_VAT_RATE_BPS = 1500;
/** تجريبي، ليس قرار المالك: المهلة الحقيقية سؤال مفتوح للمالك. */
const DEMO_PAYMENT_WINDOW_MINUTES = 30;
/** تجريبي، ليس قرار المالك: قاعدة البدء الحقيقية سؤال مفتوح للمالك. */
const DEMO_START_RULE = "on_payment";
const DEMO_PERCENT_BPS = 1000;

/**
 * المرافق المشمولة كما تسمّيها شروط الاستخدام الحالية: «صالة الحديد واللياقة والحصص الجماعية، مع المسبح
 * والجاكوزي والساونا والبخار ضمن الاشتراك» (CLUB_FACTS §7). الأسماء نفسها في قسم المرافق بالقاموس.
 */
const BENEFITS = [
  { labelAr: "صالة الحديد", labelEn: "Strength floor" },
  { labelAr: "التمارين الوظيفية", labelEn: "Functional training" },
  { labelAr: "الحصص الجماعية", labelEn: "Group classes" },
  { labelAr: "المسبح", labelEn: "Pool" },
  { labelAr: "الجاكوزي", labelEn: "Jacuzzi" },
  { labelAr: "الساونا", labelEn: "Sauna" },
  { labelAr: "البخار", labelEn: "Steam room" },
];

interface SeedProduct {
  slug: string;
  nameAr: string;
  nameEn: string;
  /** اسم الفئة التسويقي من تصميم المالك (كان في قاموس الموقع حتى A2). */
  tierAr?: string;
  tierEn?: string;
  months: number | null;
  bonus: number;
  /** بالهللة */
  priceMinor: number;
}

/**
 * الاشتراكات الثلاثة المعروضة في الرئيسية الحالية بأسعارها (CLUB_FACTS §4.1). الأسماء بالفصحى: «+ شهران»
 * بالرفع، لا «+ شهرين» كما في المتجر.
 */
const PLANS: SeedProduct[] = [
  {
    slug: "three-months",
    tierAr: "انطلاقة الأبطال",
    tierEn: "Champions' Start",
    nameAr: "3 أشهر + شهر مجانًا",
    nameEn: "3 months + 1 free",
    months: 3,
    bonus: 1,
    priceMinor: 69_900,
  },
  {
    slug: "six-months",
    tierAr: "مسار التغيير",
    tierEn: "The Change Path",
    nameAr: "6 أشهر + شهران مجانًا",
    nameEn: "6 months + 2 free",
    months: 6,
    bonus: 2,
    priceMinor: 99_900,
  },
  {
    slug: "one-year",
    tierAr: "رحلة الأبطال",
    tierEn: "Champions' Journey",
    nameAr: "12 شهرًا + شهران مجانًا",
    nameEn: "12 months + 2 free",
    months: 12,
    bonus: 2,
    priceMinor: 149_900,
  },
];

/** منتجات بذرة سابقة لم تعد معروضة (اشتراك شهر واحد تجريبي): تُؤرشف ولا تُحذف. */
const RETIRED_SLUGS: readonly string[] = ["one-month"];

/** إضافة تجريبية واحدة لاختبار الآلية، مربوطة بكل الباقات. ليست منتجًا للنادي. */
const DEMO_ADDON: SeedProduct = {
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
 * النسخ القديمة تُغلق عند بداية تاليتها إن وُجدت (نهايتها وحدها قابلة للتعديل)، والنسخة الحالية تُنشأ
 * إن لم توجد نسخة بالبداية نفسها.
 */
async function closeLegacyVersions(db: Db, productId: string): Promise<void> {
  for (const { validFrom, validUntil } of LEGACY_PERIODS) {
    const existing = await db.productVersion.findFirst({ where: { productId, validFrom } });
    if (existing !== null && existing.validUntil?.getTime() !== validUntil.getTime()) {
      await db.productVersion.update({ where: { id: existing.id }, data: { validUntil } });
    }
  }
}

async function ensureCurrentVersion(db: Db, productId: string, item: SeedProduct): Promise<void> {
  const existing = await db.productVersion.findFirst({
    where: { productId, validFrom: CLUB_PRICES_FROM },
  });
  if (existing !== null) {
    return;
  }
  const benefits = item.months === null ? BENEFITS.slice(0, 1) : BENEFITS;
  await db.productVersion.create({
    data: {
      productId,
      priceMinor: item.priceMinor,
      durationMonths: item.months,
      bonusMonths: item.bonus,
      validFrom: CLUB_PRICES_FROM,
      validUntil: null,
      benefits: { create: benefits.map((benefit, sortOrder) => ({ ...benefit, sortOrder })) },
    },
  });
}

async function upsertProduct(
  db: Db,
  clubId: string,
  kind: "membership" | "addon",
  item: SeedProduct,
  sortOrder: number,
): Promise<string> {
  const summary =
    kind === "addon"
      ? { summaryAr: "للتجربة فقط.", summaryEn: "For testing only." }
      : {
          summaryAr: "كل مرافق النادي في اشتراك واحد.",
          summaryEn: "Every club facility in one membership.",
        };
  const names = {
    status: "active",
    sortOrder,
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    tierAr: item.tierAr ?? null,
    tierEn: item.tierEn ?? null,
    ...summary,
  } as const;
  const product = await db.product.upsert({
    where: { slug: item.slug },
    update: names,
    create: { clubId, kind, slug: item.slug, ...names },
  });
  await closeLegacyVersions(db, product.id);
  await ensureCurrentVersion(db, product.id, item);
  return product.id;
}

/** منتجات بذرة سابقة لم تعد معروضة: أرشفة لا حذف (قد تكون لها طلبات). */
async function retireProducts(db: Db): Promise<void> {
  await db.product.updateMany({
    where: { slug: { in: [...RETIRED_SLUGS] } },
    data: { status: "archived" },
  });
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
await retireProducts(db);

await db.$disconnect();
process.stdout.write(
  `Seeded ${String(PLANS.length)} preview plans, 1 demo add-on, 2 demo coupons for ${CLUB_SLUG}.\n`,
);
