import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, listPlanAddons, type Db } from "./index";
import {
  createAddon,
  createPlan,
  createTestClub,
  TEST_NOW,
  TEST_VALID_FROM,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { testDatabaseUrl } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const DAY_MS = 86_400_000;

let db: Db;
let plan: TestProduct;
let otherPlan: TestProduct;
let first: TestProduct;
let second: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  const clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: 90_000, durationMonths: 3 });
  otherPlan = await createPlan(db, clubId, { priceMinor: 35_000, durationMonths: 1 });
  second = await createAddon(db, clubId, plan.productId, { priceMinor: 7_000 });
  first = await createAddon(db, clubId, plan.productId, { priceMinor: 5_000 });
  await db.productAddon.update({
    where: {
      membershipProductId_addonProductId: {
        membershipProductId: plan.productId,
        addonProductId: second.productId,
      },
    },
    data: { sortOrder: 1 },
  });
  const archived = await createAddon(db, clubId, plan.productId, { priceMinor: 1_000 });
  await db.product.update({ where: { id: archived.productId }, data: { status: "archived" } });
  const ended = await createAddon(db, clubId, plan.productId, { priceMinor: 2_000 });
  await db.productVersion.update({
    where: { id: ended.versionId },
    data: { validUntil: new Date(TEST_VALID_FROM.getTime() + DAY_MS) },
  });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

describe("listPlanAddons", () => {
  it("يرجع إضافات الباقة الفعّالة ذات النسخة السارية بترتيب الربط وسعرها", async () => {
    const addons = await listPlanAddons(db, plan.slug, TEST_NOW);
    expect(addons.map((addon) => addon.slug)).toEqual([first.slug, second.slug]);
    expect(addons[0]).toMatchObject({
      name: { ar: "منتج اختبار", en: "Test product" },
      listPrice: { amountMinor: 5_000, currency: "SAR" },
    });
  });

  it("باقة بلا إضافات أو غير موجودة ⇒ قائمة فارغة", async () => {
    expect(await listPlanAddons(db, otherPlan.slug, TEST_NOW)).toEqual([]);
    expect(await listPlanAddons(db, "no-such-plan", TEST_NOW)).toEqual([]);
  });
});
