import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembershipPlan } from "@masar/domain";
import { createDb, listMembershipPlans, type Db } from "./index";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const CLUB = "catalog-test-club";
const NOW = new Date("2026-06-15T12:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");
const RECENT = new Date("2026-06-01T00:00:00Z");
const FUTURE = new Date("2026-07-01T00:00:00Z");
let db: Db;
let clubId: string;

async function cleanup(): Promise<void> {
  await db.productBenefit.deleteMany({ where: { version: { product: { club: { slug: CLUB } } } } });
  await db.productVersion.deleteMany({ where: { product: { club: { slug: CLUB } } } });
  await db.product.deleteMany({ where: { club: { slug: CLUB } } });
  await db.club.deleteMany({ where: { slug: CLUB } });
}

interface VersionInput {
  priceMinor: number;
  durationMonths?: number | null;
  bonusMonths?: number;
  validFrom: Date;
  validUntil?: Date;
  /** [النص، ترتيب العرض] */
  benefits?: [label: string, sortOrder: number][];
}

async function findPlan(slug: string, now: Date): Promise<MembershipPlan | undefined> {
  return (await listMembershipPlans(db, now)).find((plan) => plan.slug === slug);
}

async function addProduct(
  slug: string,
  options: {
    status?: "draft" | "active" | "archived";
    kind?: "membership" | "digital_program";
    sortOrder?: number;
  },
  versions: VersionInput[],
): Promise<void> {
  await db.product.create({
    data: {
      clubId,
      slug: `ct-${slug}`,
      kind: options.kind ?? "membership",
      status: options.status ?? "active",
      sortOrder: options.sortOrder ?? 0,
      nameAr: `باقة ${slug}`,
      nameEn: `Plan ${slug}`,
      summaryAr: "وصف",
      summaryEn: "Summary",
      versions: {
        create: versions.map(({ benefits = [], durationMonths = 12, ...version }) => ({
          ...version,
          durationMonths,
          benefits: {
            create: benefits.map(([label, sortOrder]) => ({
              labelAr: label,
              labelEn: label,
              sortOrder,
            })),
          },
        })),
      },
    },
  });
}

beforeAll(async () => {
  db = createDb(url);
  await cleanup();
  clubId = (await db.club.create({ data: { slug: CLUB, nameAr: "نادٍ", nameEn: "Club" } })).id;

  await addProduct("year", { sortOrder: 2 }, [
    { priceMinor: 300000, validFrom: PAST, validUntil: RECENT }, // انتهت
    // السارية. المزايا تُدرج بعكس ترتيب عرضها: الترتيب يجب أن يأتي من sort_order لا من ترتيب الإدراج
    {
      priceMinor: 280000,
      bonusMonths: 2,
      validFrom: RECENT,
      validUntil: FUTURE,
      benefits: [
        ["ثانية", 1],
        ["أولى", 0],
      ],
    },
    { priceMinor: 999999, validFrom: FUTURE }, // لم تبدأ
  ]);
  await addProduct("month", { sortOrder: 1 }, [
    { priceMinor: 35000, durationMonths: 1, validFrom: PAST },
  ]);
  await addProduct("draft", { status: "draft" }, [{ priceMinor: 1, validFrom: PAST }]);
  await addProduct("archived", { status: "archived" }, [{ priceMinor: 1, validFrom: PAST }]);
  await addProduct("program", { kind: "digital_program" }, [{ priceMinor: 1, validFrom: PAST }]);
  await addProduct("upcoming", {}, [{ priceMinor: 1, validFrom: FUTURE }]); // لا نسخة سارية
  await addProduct("expired", {}, [{ priceMinor: 1, validFrom: PAST, validUntil: RECENT }]);
  await addProduct("no-duration", {}, [{ priceMinor: 1, durationMonths: null, validFrom: PAST }]);
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

function ours<T extends { slug: string }>(plans: T[]): T[] {
  return plans.filter((plan) => plan.slug.startsWith("ct-"));
}

describe("listMembershipPlans", () => {
  it("يعرض الاشتراكات النشطة ذات النسخة السارية فقط، بترتيب العرض", async () => {
    const plans = ours(await listMembershipPlans(db, NOW));
    expect(plans.map((plan) => plan.slug)).toEqual(["ct-month", "ct-year"]);
  });

  it("يأخذ النسخة السارية لا المنتهية ولا القادمة", async () => {
    const year = ours(await listMembershipPlans(db, NOW)).find((plan) => plan.slug === "ct-year");
    expect(year?.price).toEqual({ amountMinor: 280000, currency: "SAR" });
    expect(year?.paidMonths).toBe(12);
    expect(year?.bonusMonths).toBe(2);
    expect(year?.benefits.map((benefit) => benefit.ar)).toEqual(["أولى", "ثانية"]);
  });

  it("السعر يتبع التاريخ: قبل تغيير النسخة وبعد بدء القادمة", async () => {
    const before = await findPlan("ct-year", new Date("2026-03-01T00:00:00Z"));
    const after = await findPlan("ct-year", new Date("2026-08-01T00:00:00Z"));
    expect(before?.price.amountMinor).toBe(300000);
    expect(after?.price.amountMinor).toBe(999999);
  });

  it("لحظة انتهاء النسخة هي لحظة بدء التالية بلا فجوة ولا تداخل", async () => {
    const justBefore = new Date(RECENT.getTime() - 1);
    expect((await findPlan("ct-year", justBefore))?.price.amountMinor).toBe(300000);
    expect((await findPlan("ct-year", RECENT))?.price.amountMinor).toBe(280000);
  });

  it("النسخة المنتهية تُعرض حتى آخر لحظة ثم تختفي عند لحظة انتهائها تمامًا", async () => {
    const justBefore = new Date(RECENT.getTime() - 1);
    expect(await findPlan("ct-expired", justBefore)).toBeDefined();
    expect(await findPlan("ct-expired", RECENT)).toBeUndefined();
  });
});

describe("ما ليس معروضًا للبيع", () => {
  it("الباقة المعروضة تحمل اسمها باللغتين", async () => {
    expect((await findPlan("ct-month", NOW))?.name).toEqual({
      ar: "باقة month",
      en: "Plan month",
    });
  });

  it.each([
    "ct-draft",
    "ct-archived",
    "ct-program",
    "ct-upcoming",
    "ct-expired",
    "ct-no-duration",
    "ct-missing",
  ])("لا يرجع ما ليس معروضًا للبيع: %s", async (slug) => {
    expect(await findPlan(slug, NOW)).toBeUndefined();
  });
});

describe("قيود القاعدة", () => {
  it("ترفض نسختين ساريتين للمنتج نفسه في فترة متداخلة", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "ct-month" } });
    const overlapping = db.productVersion.create({
      data: { productId: product.id, priceMinor: 100, durationMonths: 1, validFrom: RECENT },
    });
    await expect(overlapping).rejects.toThrow();
  });

  it("تقبل نسخة تبدأ لحظة انتهاء سابقتها تمامًا", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "ct-expired" } });
    const next = await db.productVersion.create({
      data: {
        productId: product.id,
        priceMinor: 100,
        durationMonths: 1,
        validFrom: RECENT,
        validUntil: FUTURE,
      },
    });
    await db.productVersion.delete({ where: { id: next.id } });
  });

  it("ترفض عملة غير مدعومة", async () => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "ct-upcoming" } });
    const foreign = db.productVersion.create({
      data: {
        productId: product.id,
        priceMinor: 100,
        durationMonths: 1,
        currency: "USD",
        validFrom: PAST,
        validUntil: RECENT,
      },
    });
    await expect(foreign).rejects.toThrow();
  });

  it.each(["Bad-Slug", "bad slug", "bad_slug", "-bad", "bad-", "bad--slug", ""])(
    "ترفض معرّفًا نصيًا لا يصلح رابطًا: «%s»",
    async (slug) => {
      const attempt = db.product.create({
        data: {
          clubId,
          slug,
          kind: "membership",
          nameAr: "x",
          nameEn: "x",
          summaryAr: "x",
          summaryEn: "x",
        },
      });
      await expect(attempt).rejects.toThrow();
    },
  );

  it.each([
    ["سعر سالب", { priceMinor: -1 }],
    ["مدة صفرية", { durationMonths: 0 }],
    ["أشهر مجانية سالبة", { bonusMonths: -1 }],
    ["فترة سريان مقلوبة", { validUntil: new Date("2025-01-01T00:00:00Z") }],
  ])("ترفض %s", async (_name, bad) => {
    const product = await db.product.findUniqueOrThrow({ where: { slug: "ct-month" } });
    const attempt = db.productVersion.create({
      data: { productId: product.id, priceMinor: 100, durationMonths: 1, validFrom: PAST, ...bad },
    });
    await expect(attempt).rejects.toThrow();
  });
});
