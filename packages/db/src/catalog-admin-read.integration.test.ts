import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countCatalogProducts,
  countOtherSellableMemberships,
  createDb,
  createOrder,
  getCatalogProduct,
  listCatalogProducts,
  listMembershipPlans,
  type Db,
} from "./index";
import {
  createAddon,
  createAssessedService,
  createPlan,
  createTestClub,
  TEST_NOW,
  TEST_VALID_FROM,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const PRICE = 90_000;
const OLD_PRICE = 80_000;
const CHANGED_AT = new Date("2026-03-01T00:00:00Z");

let db: Db;
let clubId: string;
let otherClubId: string;
let active: TestProduct;
let draft: TestProduct;
let archived: TestProduct;
let noDuration: TestProduct;
let addon: TestProduct;

/** نسخة ثانية للمنتج من `CHANGED_AT`: تُغلق الأولى عندها (كما تفعل اللوحة)، فسجل النسخ نسختان. */
async function addSecondVersion(product: TestProduct, priceMinor: number): Promise<string> {
  await db.productVersion.update({
    where: { id: product.versionId },
    data: { validUntil: CHANGED_AT },
  });
  const version = await db.productVersion.create({
    data: {
      productId: product.productId,
      priceMinor,
      durationMonths: product.durationMonths,
      bonusMonths: product.bonusMonths,
      validFrom: CHANGED_AT,
      benefits: { create: [{ labelAr: "ميزة جديدة", labelEn: "New benefit", sortOrder: 0 }] },
    },
  });
  return version.id;
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  active = await createPlan(db, clubId, {
    priceMinor: OLD_PRICE,
    durationMonths: 3,
    bonusMonths: 1,
  });
  draft = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 6 });
  archived = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 12 });
  noDuration = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 1 });
  addon = await createAddon(db, clubId, active.productId, { priceMinor: 5_000 });
  await createAssessedService(db, clubId, { priceMinor: 0 });
  await createPlan(db, otherClubId, { priceMinor: PRICE, durationMonths: 1 });
  await db.product.update({
    where: { id: draft.productId },
    data: { status: "draft", sortOrder: 2 },
  });
  await db.product.update({
    where: { id: archived.productId },
    data: { status: "archived", sortOrder: 3 },
  });
  await db.product.update({
    where: { id: active.productId },
    data: { sortOrder: 1, tierAr: "رحلة الأبطال", tierEn: "Champions' Journey" },
  });
  // اشتراك فعّال نسخته السارية أُغلقت: لا نسخة سارية الآن
  await db.product.update({ where: { id: noDuration.productId }, data: { sortOrder: 4 } });
  await db.productVersion.update({
    where: { id: noDuration.versionId },
    data: { validUntil: CHANGED_AT },
  });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

describe("listCatalogProducts", () => {
  it("كل الحالات بترتيب العرض، مع النسخة السارية و«قابل للبيع» بقاعدة المجال", async () => {
    const rows = await listCatalogProducts(db, clubId, "membership", TEST_NOW);
    expect(
      rows.map((row) => [row.slug, row.status, row.sellable, row.currentVersion !== null]),
    ).toEqual([
      [active.slug, "active", true, true],
      [draft.slug, "draft", false, true],
      [archived.slug, "archived", false, true],
      [noDuration.slug, "active", false, false],
    ]);
    expect(rows[0]).toMatchObject({
      tier: { ar: "رحلة الأبطال", en: "Champions' Journey" },
      currentVersion: { price: { amountMinor: OLD_PRICE }, durationMonths: 3, bonusMonths: 1 },
      versionCount: 1,
      soldItems: 0,
    });
    expect(rows[1]?.tier).toBeNull();
  });

  it("عزل النادي والنوع، وعدّ المنتجات لكل نوع", async () => {
    const addons = await listCatalogProducts(db, clubId, "addon", TEST_NOW);
    expect(addons.map((row) => row.slug)).toEqual([addon.slug]);
    expect(addons[0]?.sellable).toBe(true);
    expect(await listCatalogProducts(db, otherClubId, "addon", TEST_NOW)).toEqual([]);
    expect(await countCatalogProducts(db, clubId)).toEqual({
      membership: 4,
      addon: 1,
      assessed_service: 1,
      digital_program: 0,
    });
  });

  it("عدّ المباع يشمل كل سطر طلب للمنتج، وعدد النسخ يزيد بنسخة جديدة", async () => {
    const order = orderInput(active.slug, OLD_PRICE + 5_000, {
      addonSlugs: [addon.slug],
      buyer: testBuyer(testPhone(1)),
    });
    unwrap(await createOrder(db, order));
    await addSecondVersion(active, PRICE);
    const [row] = await listCatalogProducts(db, clubId, "membership", TEST_NOW);
    expect(row).toMatchObject({
      versionCount: 2,
      soldItems: 1,
      currentVersion: { price: { amountMinor: PRICE } },
    });
    const [addonRow] = await listCatalogProducts(db, clubId, "addon", TEST_NOW);
    expect(addonRow?.soldItems).toBe(1);
  });

  it("الباقات القابلة للبيع الأخرى: المسودة والمؤرشفة وما بلا نسخة سارية لا تُعدّ", async () => {
    expect(await countOtherSellableMemberships(db, clubId, active.productId, TEST_NOW)).toBe(0);
    expect(await countOtherSellableMemberships(db, clubId, draft.productId, TEST_NOW)).toBe(1);
  });
});

describe("getCatalogProduct", () => {
  it("سجل النسخ الأحدث أولًا، بعدد المباع من كل نسخة والمزايا، والسارية معلَّمة", async () => {
    const detail = await getCatalogProduct(db, clubId, active.productId, TEST_NOW);
    expect(detail?.versions.map((v) => [v.price.amountMinor, v.current, v.soldItems])).toEqual([
      [PRICE, true, 0],
      [OLD_PRICE, false, 1],
    ]);
    expect(detail?.versions[1]).toMatchObject({
      validFrom: TEST_VALID_FROM,
      validUntil: CHANGED_AT,
    });
    expect(detail?.currentVersion?.benefits).toEqual([{ ar: "ميزة جديدة", en: "New benefit" }]);
    expect(detail).toMatchObject({
      sellable: true,
      soldItems: 1,
      pendingOrders: 1,
      kind: "membership",
    });
    expect(detail?.links.map((link) => [link.slug, link.linked])).toEqual([[addon.slug, true]]);
  });

  it("الطلب المعلّق داخل مهلته يُعدّ، وبعد مهلته لا", async () => {
    const created = new Date("2026-06-15T08:50:00Z");
    const input = orderInput(active.slug, PRICE, { buyer: testBuyer(testPhone(2)), now: created });
    unwrap(await createOrder(db, input));
    const live = await getCatalogProduct(db, clubId, active.productId, TEST_NOW);
    expect(live?.pendingOrders).toBe(2);
    const later = await getCatalogProduct(
      db,
      clubId,
      active.productId,
      new Date("2026-06-15T10:00:00Z"),
    );
    expect(later?.pendingOrders).toBe(0);
  });

  it("الإضافة ترى كل اشتراكات النادي غير المؤرشفة ومعها هل هي مرتبطة", async () => {
    const detail = await getCatalogProduct(db, clubId, addon.productId, TEST_NOW);
    expect(detail?.links.map((link) => [link.slug, link.linked])).toEqual([
      [active.slug, true],
      [draft.slug, false],
      [noDuration.slug, false],
    ]);
  });

  it("منتج من نادٍ آخر لا يُرى، ورمز القفل يتغير بتغيّر النسخة السارية", async () => {
    expect(await getCatalogProduct(db, otherClubId, active.productId, TEST_NOW)).toBeUndefined();
    const now = await getCatalogProduct(db, clubId, active.productId, TEST_NOW);
    const before = await getCatalogProduct(
      db,
      clubId,
      active.productId,
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(now?.lockToken).not.toBe(before?.lockToken);
    expect(before?.currentVersion?.price.amountMinor).toBe(OLD_PRICE);
  });
});

describe("listMembershipPlans (الموقع العام)", () => {
  it("اسم الفئة من القاعدة، وغير القابل للبيع لا يظهر", async () => {
    const plans = await listMembershipPlans(db, TEST_NOW);
    const own = plans.filter((plan) =>
      [active, draft, archived, noDuration].some((p) => p.slug === plan.slug),
    );
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({
      slug: active.slug,
      tier: { ar: "رحلة الأبطال", en: "Champions' Journey" },
      price: { amountMinor: PRICE },
    });
  });
});
