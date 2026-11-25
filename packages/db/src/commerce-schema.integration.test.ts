import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import {
  createAddon,
  createAssessedService,
  createDigitalProgram,
  createPlan,
  createPromotion,
  createTestClub,
  includedVat,
  insertRawOrder,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const PLAN_PRICE_MINOR = 90_000;
const PLAN_MONTHS = 3;
const ADDON_PRICE_MINOR = 5_000;
const PROGRAM_PRICE_MINOR = 20_000;
const DISCOUNT_MINOR = 9_000;
const MIGRATE_DIFF_TIMEOUT_MS = 120_000;
const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));

let db: Db;
let clubId: string;
let plan: TestProduct;
let addon: TestProduct;
let program: TestProduct;

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, {
    priceMinor: PLAN_PRICE_MINOR,
    durationMonths: PLAN_MONTHS,
    bonusMonths: 1,
  });
  addon = await createAddon(db, clubId, plan.productId, { priceMinor: ADDON_PRICE_MINOR });
  program = await createDigitalProgram(db, clubId, { priceMinor: PROGRAM_PRICE_MINOR });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

describe("شروط النسخة التجارية ثابتة", () => {
  it.each([
    ["السعر", "price_minor = price_minor + 1"],
    ["المدة", "duration_months = duration_months + 1"],
    ["الأشهر المجانية", "bonus_months = bonus_months + 1"],
    ["بداية السريان", "valid_from = valid_from - interval '1 day'"],
  ])("تعديل %s مرفوض", async (_name, assignment) => {
    const update = db.$executeRawUnsafe(
      `UPDATE product_versions SET ${assignment} WHERE id = $1::uuid`,
      plan.versionId,
    );
    await expect(update).rejects.toThrow("product_version_terms_immutable");
  });

  it("إنهاء السريان (valid_until) مقبول", async () => {
    const other = await createPlan(db, clubId, { priceMinor: 1, durationMonths: 1 });
    const end = new Date("2027-01-01T00:00:00Z");
    await db.productVersion.update({ where: { id: other.versionId }, data: { validUntil: end } });
    const row = await db.productVersion.findUniqueOrThrow({ where: { id: other.versionId } });
    expect(row.validUntil).toEqual(end);
  });
});

describe("مزايا النسخة المباعة ثابتة", () => {
  beforeAll(async () => {
    await insertRawOrder(db, { clubId, lines: [{ product: plan }] });
  });

  it("لا تُضاف ولا تُعدَّل ولا تُحذف", async () => {
    const add = db.productBenefit.create({
      data: { versionId: plan.versionId, labelAr: "جديدة", labelEn: "New" },
    });
    await expect(add).rejects.toThrow("product_version_benefits_frozen");
    const edit = db.productBenefit.updateMany({
      where: { versionId: plan.versionId },
      data: { labelAr: "معدلة" },
    });
    await expect(edit).rejects.toThrow("product_version_benefits_frozen");
    const remove = db.productBenefit.deleteMany({ where: { versionId: plan.versionId } });
    await expect(remove).rejects.toThrow("product_version_benefits_frozen");
  });

  it("النسخة المباعة نفسها لا تُحذف", async () => {
    const remove = db.productVersion.delete({ where: { id: plan.versionId } });
    await expect(remove).rejects.toThrow();
    expect(await db.productVersion.count({ where: { id: plan.versionId } })).toBe(1);
  });

  it("نسخة غير مباعة تُعدَّل مزاياها وتُحذف معها", async () => {
    const unsold = await createPlan(db, clubId, { priceMinor: 1, durationMonths: 1 });
    await db.productBenefit.updateMany({
      where: { versionId: unsold.versionId },
      data: { labelAr: "معدلة" },
    });
    await db.productVersion.delete({ where: { id: unsold.versionId } });
    expect(await db.productBenefit.count({ where: { versionId: unsold.versionId } })).toBe(0);
  });
});

describe("سطر الطلب يطابق نسخته", () => {
  it.each([
    ["سعر يخالف النسخة", () => ({ ...plan, priceMinor: plan.priceMinor + 1 })],
    ["أشهر مجانية تخالف النسخة", () => ({ ...plan, bonusMonths: plan.bonusMonths + 1 })],
  ])("%s مرفوض", async (_name, product) => {
    const order = insertRawOrder(db, { clubId, lines: [{ product: product() }] });
    await expect(order).rejects.toThrow(
      "order_items_product_version_id_product_id_list_price_minor_fkey",
    );
  });

  it("مدة تخالف النسخة مرفوضة", async () => {
    const order = insertRawOrder(db, {
      clubId,
      lines: [{ product: { ...plan, durationMonths: PLAN_MONTHS + 1 } }],
    });
    await expect(order).rejects.toThrow("order_items_product_version_id_duration_months_fkey");
  });

  it("نوع سطر يخالف نوع المنتج مرفوض", async () => {
    const asProgram: TestProduct = { ...plan, kind: "digital_program", durationMonths: null };
    const order = insertRawOrder(db, { clubId, lines: [{ product: asProgram }] });
    await expect(order).rejects.toThrow("order_items_product_id_kind_fkey");
  });

  it("الخدمة بتقييم لا تدخل طلبًا", async () => {
    const service = await createAssessedService(db, clubId, { priceMinor: 1_000 });
    const order = insertRawOrder(db, { clubId, lines: [{ product: service }] });
    await expect(order).rejects.toThrow("order_items_kind_sellable");
  });

  it("سطر أساسي ثانٍ مرفوض", async () => {
    const order = insertRawOrder(db, { clubId, lines: [{ product: plan }, { product: program }] });
    await expect(order).rejects.toThrow("order_items_primary_position");
  });

  it("إضافة مع برنامج رقمي مرفوضة عند الاعتماد", async () => {
    const order = insertRawOrder(db, { clubId, lines: [{ product: program }, { product: addon }] });
    await expect(order).rejects.toThrow("order_addon_requires_membership");
  });

  it("ضريبة سطر تخالف الصيغة بهللة واحدة مرفوضة", async () => {
    const vat = includedVat(plan.priceMinor, 1500) + 1;
    const order = insertRawOrder(db, {
      clubId,
      lines: [{ product: plan, vatMinor: vat }],
    });
    await expect(order).rejects.toThrow("order_items_vat_formula");
  });
});

describe("مجاميع الرأس تُفحص عند الاعتماد", () => {
  it("طلب صحيح بإضافة وخصم يُقبل بمرجع MSR", async () => {
    const promotionId = await createPromotion(db, clubId);
    const { orderId } = await insertRawOrder(db, {
      clubId,
      lines: [{ product: plan, discountMinor: DISCOUNT_MINOR }, { product: addon }],
      discounts: [{ promotionId, amountMinor: DISCOUNT_MINOR }],
    });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.reference).toMatch(/^MSR-[0-9]{7}$/);
    expect(order.totalMinor).toBe(PLAN_PRICE_MINOR + ADDON_PRICE_MINOR - DISCOUNT_MINOR);
    expect(order.status).toBe("pending_payment");
  });

  it("مجموع رأس يخالف السطور مرفوض", async () => {
    const order = insertRawOrder(db, {
      clubId,
      lines: [{ product: plan }],
      head: { subtotalMinor: PLAN_PRICE_MINOR + 1, totalMinor: PLAN_PRICE_MINOR + 1 },
    });
    await expect(order).rejects.toThrow("order_totals_mismatch");
  });

  it("طلب بلا سطر أساسي مرفوض", async () => {
    const order = insertRawOrder(db, {
      clubId,
      lines: [],
      head: { subtotalMinor: 1, totalMinor: 1, vatMinor: 0 },
    });
    await expect(order).rejects.toThrow("order_primary_item_required");
  });

  it("خصم سطور بلا سطر خصم يطابقه مرفوض", async () => {
    const order = insertRawOrder(db, {
      clubId,
      lines: [{ product: plan, discountMinor: DISCOUNT_MINOR }],
    });
    await expect(order).rejects.toThrow("order_totals_mismatch");
  });

  it("طلب بإجمالي صفر مرفوض", async () => {
    const order = insertRawOrder(db, {
      clubId,
      lines: [{ product: { ...addon, kind: "membership" } }],
      head: { subtotalMinor: 0, totalMinor: 0, vatMinor: 0 },
    });
    await expect(order).rejects.toThrow("orders_total_positive");
  });
});

describe("حساب الأشهر في القاعدة (make_interval) يقصّ آخر الشهر", () => {
  it.each([
    ["2027-01-31", 1, "2027-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2028-02-29", 12, "2029-02-28"],
    ["2026-11-30", 14, "2028-01-30"],
    ["2026-03-31", 1, "2026-04-30"],
    ["2026-06-15", 4, "2026-10-15"],
  ])("%s + %i شهر = %s", async (start, months, expected) => {
    const rows = await db.$queryRaw<{ end: string }[]>`
      SELECT (${start}::date + make_interval(months => ${months}::integer))::date::text AS "end"`;
    expect(rows[0]?.end).toBe(expected);
  });
});

describe("قيود القيم", () => {
  it("جوال عميل بغير صيغة سعودية E.164 مرفوض", async () => {
    const order = insertRawOrder(db, { clubId, phone: "0512345678", lines: [{ product: plan }] });
    await expect(order).rejects.toThrow("customers_phone_shape");
  });

  it.each([-1, 10_001])("نسبة ضريبة النادي خارج 0..10000 مرفوضة: %i", async (vatRateBps) => {
    await expect(createTestClub(db, { vatRateBps })).rejects.toThrow("clubs_vat_rate_range");
  });

  it("مهلة دفع غير موجبة مرفوضة", async () => {
    const club = createTestClub(db, { orderPaymentWindowMinutes: 0 });
    await expect(club).rejects.toThrow("clubs_order_payment_window_positive");
  });
});

function shadowUrl(base: string): string {
  const shadow = new URL(base);
  shadow.pathname = `${shadow.pathname}_shadow`;
  return shadow.toString();
}

describe("الترحيلات تطابق schema.prisma", () => {
  it(
    "prisma migrate diff لا يرى فرقًا",
    async () => {
      const shadow = shadowUrl(url);
      const name = new URL(shadow).pathname.slice(1);
      expect(name).toMatch(/^[a-z0-9_]+$/);
      await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
      await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      try {
        const args = ["migrate", "diff", "--from-migrations", "prisma/migrations"];
        args.push("--to-schema", "prisma/schema.prisma", "--exit-code");
        const output = execFileSync("node_modules/.bin/prisma", args, {
          cwd: PACKAGE_ROOT,
          env: { ...process.env, SHADOW_DATABASE_URL: shadow },
          encoding: "utf8",
        });
        expect(output).toContain("No difference detected");
      } finally {
        await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      }
    },
    MIGRATE_DIFF_TIMEOUT_MS,
  );
});
