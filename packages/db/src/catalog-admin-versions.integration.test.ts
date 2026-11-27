import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  changeProductVersion,
  createDb,
  createOrder,
  createProduct,
  getCatalogProduct,
  getOrderDetail,
  staffActor,
  type CatalogProductDetail,
  type Db,
} from "./index";
import { productDraft, productTerms } from "./test-support/catalog-admin-fixtures";
import { createPlan, createTestClub, TEST_NOW } from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  failure,
  orderInput,
  refusalReasons,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const MINUTE_MS = 60_000;
const RACE_ROUNDS = 8;
const at = (minutes: number): Date => new Date(TEST_NOW.getTime() + minutes * MINUTE_MS);

let db: Db;
let other: Db;
let clubId: string;
let actor: ReturnType<typeof staffActor>;
let phoneIndex = 100;

function nextBuyer() {
  phoneIndex += 1;
  return testBuyer(testPhone(phoneIndex));
}

async function newProduct(
  change: Parameters<typeof productDraft>[0] = {},
): Promise<CatalogProductDetail> {
  const productId = randomUUID();
  unwrap(
    await createProduct(db, {
      productId,
      clubId,
      draft: productDraft(change),
      actor,
      now: TEST_NOW,
    }),
  );
  return detailOf(productId);
}

async function detailOf(productId: string, now = at(1)): Promise<CatalogProductDetail> {
  const detail = await getCatalogProduct(db, clubId, productId, now);
  if (detail === undefined) {
    throw new Error("المنتج غير موجود");
  }
  return detail;
}

function actions(productId: string): Promise<string[]> {
  return db.auditLog
    .findMany({ where: { entityId: productId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    .then((rows) => rows.map((row) => row.action));
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  actor = staffActor((await createTestStaff(db, clubId, { role: "manager" })).id);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

describe("changeProductVersion", () => {
  const change = (
    product: CatalogProductDetail,
    terms = productTerms({ price: "1000" }),
    now = at(5),
  ) =>
    changeProductVersion(db, {
      productId: product.id,
      clubId,
      lockToken: product.lockToken,
      terms,
      canChangePublished: true,
      actor,
      now,
    });

  it("تغيير السعر ⇒ نسخة جديدة والقديمة مغلقة عند اللحظة نفسها بلا تداخل ولا تعديل لشروطها", async () => {
    const product = await newProduct();
    const first = product.currentVersion;
    const changed = unwrap(await change(product));
    expect(changed.written).toBe("version");
    const after = await detailOf(product.id, at(6));
    expect(
      after.versions.map((v) => [v.price.amountMinor, v.validFrom, v.validUntil, v.current]),
    ).toEqual([
      [100_000, at(5), null, true],
      [90_000, TEST_NOW, at(5), false],
    ]);
    expect(after.versions[1]?.id).toBe(first?.id);
    expect(after.currentVersion?.benefits).toEqual(first?.benefits);
    const audit = await db.auditLog.findFirst({
      where: { entityId: product.id, action: "product_version_created" },
    });
    expect(audit?.data).toMatchObject({
      priceMinor: 100_000,
      previousPriceMinor: 90_000,
      previousVersionId: first?.id,
      changed: "price",
    });
  });

  it.each([
    ["المدة", { durationMonths: "6" }, "duration"],
    ["الأشهر المجانية", { bonusMonths: "0" }, "bonus"],
  ])("تغيير %s ⇒ نسخة جديدة", async (_name, input, changed) => {
    const product = await newProduct();
    expect(unwrap(await change(product, productTerms(input))).written).toBe("version");
    const audit = await db.auditLog.findFirst({
      where: { entityId: product.id, action: "product_version_created" },
    });
    expect(audit?.data).toMatchObject({ changed });
  });

  it("لا فرق ⇒ لا كتابة", async () => {
    const product = await newProduct();
    expect(unwrap(await change(product, productTerms())).written).toBe("none");
    expect(await actions(product.id)).toEqual(["product_created"]);
  });

  it("مزايا نسخة لم تُبع تُعدَّل في مكانها", async () => {
    const product = await newProduct();
    const terms = productTerms({
      benefits: [{ ar: "ميزة واحدة", en: "One benefit", sortOrder: "" }],
    });
    const changed = unwrap(await change(product, terms));
    expect(changed).toEqual({ written: "benefits", versionId: product.currentVersion?.id });
    const after = await detailOf(product.id, at(6));
    expect(after.versions).toHaveLength(1);
    expect(after.currentVersion?.benefits).toEqual([{ ar: "ميزة واحدة", en: "One benefit" }]);
    expect(await actions(product.id)).toEqual(["product_created", "product_benefits_updated"]);
  });

  it("مزايا نسخة مباعة ⇒ نسخة جديدة بالشروط نفسها، ولقطة الطلب القديم ثابتة", async () => {
    const plan = await createPlan(db, clubId, {
      priceMinor: 90_000,
      durationMonths: 3,
      benefits: ["قديمة"],
    });
    const order = unwrap(
      await createOrder(db, orderInput(plan.slug, 90_000, { buyer: nextBuyer() })),
    );
    const product = await detailOf(plan.productId);
    const terms = productTerms({
      bonusMonths: "0",
      benefits: [{ ar: "جديدة", en: "New", sortOrder: "" }],
    });
    const changed = unwrap(await change(product, terms));
    expect(changed.written).toBe("version");
    const after = await detailOf(plan.productId, at(6));
    expect(
      after.versions.map((v) => [v.price.amountMinor, v.soldItems, v.benefits.map((b) => b.ar)]),
    ).toEqual([
      [90_000, 0, ["جديدة"]],
      [90_000, 1, ["قديمة"]],
    ]);
    const snapshot = await getOrderDetail(db, clubId, order.orderId, at(6));
    expect(snapshot?.order.items[0]).toMatchObject({
      benefits: [{ ar: "قديمة", en: "قديمة" }],
      listPrice: { amountMinor: 90_000 },
    });
  });

  it("طلب أُنشئ قبل تغيير السعر يحتفظ بلقطته، والطلب التالي يُختم بالسعر الجديد", async () => {
    const plan = await createPlan(db, clubId, {
      priceMinor: 90_000,
      durationMonths: 3,
      bonusMonths: 1,
    });
    const before = unwrap(
      await createOrder(db, orderInput(plan.slug, 90_000, { buyer: nextBuyer() })),
    );
    unwrap(await change(await detailOf(plan.productId)));
    const stale = failure(
      await createOrder(db, orderInput(plan.slug, 90_000, { buyer: nextBuyer(), now: at(6) })),
    );
    expect(stale.cause).toEqual({ totalMinor: 100_000 });
    const after = unwrap(
      await createOrder(db, orderInput(plan.slug, 100_000, { buyer: nextBuyer(), now: at(6) })),
    );
    const totals = await db.order.findMany({
      where: { id: { in: [before.orderId, after.orderId] } },
      orderBy: { createdAt: "asc" },
      select: { totalMinor: true },
    });
    expect(totals.map((row) => row.totalMinor)).toEqual([90_000, 100_000]);
  });

  it("رمز قفل قديم مرفوض، وتغييران متزامنان: نسخة واحدة جديدة فقط", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const product = await newProduct();
      const attempt = (client: Db, price: string) =>
        changeProductVersion(client, {
          productId: product.id,
          clubId,
          lockToken: product.lockToken,
          terms: productTerms({ price }),
          canChangePublished: true,
          actor,
          now: at(5),
        });
      const results = await Promise.all([attempt(db, "1000"), attempt(other, "1100")]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(refusalReasons(results)).toEqual(["catalog.stale_edit"]);
      const after = await detailOf(product.id, at(6));
      expect(after.versions).toHaveLength(2);
      expect(after.versions.filter((version) => version.current)).toHaveLength(1);
    }
  });

  it("تغيير سعر مع createOrder متزامن: الطلب يُختم بنسخة واحدة صحيحة بسعرها", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const plan = await createPlan(db, clubId, {
        priceMinor: 90_000,
        durationMonths: 3,
        bonusMonths: 1,
      });
      const product = await detailOf(plan.productId);
      const [changed, created] = await Promise.all([
        change(product, productTerms({ price: "1000" }), at(5)),
        createOrder(other, orderInput(plan.slug, 90_000, { buyer: nextBuyer(), now: at(5) })),
      ]);
      expect(changed.ok).toBe(true);
      const versions = await db.productVersion.findMany({ where: { productId: plan.productId } });
      const items = await db.orderItem.findMany({ where: { productId: plan.productId } });
      // الطلب إما خُتم بالنسخة القديمة بسعرها، أو رُفض لأن السعر تغيّر قبله؛ لا لقطة بسعر نسخة أخرى
      expect(items).toHaveLength(created.ok ? 1 : 0);
      for (const item of items) {
        const version = versions.find((candidate) => candidate.id === item.productVersionId);
        expect(item.listPriceMinor).toBe(version?.priceMinor);
        expect(item.listPriceMinor).toBe(90_000);
      }
      if (!created.ok) {
        expect(created.error.reason).toBe("cart.price_changed");
      }
    }
  });

  it("منتج منشور بلا صلاحية النشر ⇒ catalog.publish_required، والمسودة تُعدَّل", async () => {
    const plan = await createPlan(db, clubId, {
      priceMinor: 90_000,
      durationMonths: 3,
      bonusMonths: 1,
    });
    const product = await detailOf(plan.productId);
    const refused = failure(
      await changeProductVersion(db, {
        productId: product.id,
        clubId,
        lockToken: product.lockToken,
        terms: productTerms({ price: "1000" }),
        canChangePublished: false,
        actor,
        now: at(5),
      }),
    );
    expect(refused).toMatchObject({ code: "forbidden", reason: "catalog.publish_required" });
    const draft = await newProduct();
    const allowed = await changeProductVersion(db, {
      productId: draft.id,
      clubId,
      lockToken: draft.lockToken,
      terms: productTerms({ price: "1000" }),
      canChangePublished: false,
      actor,
      now: at(5),
    });
    expect(allowed.ok).toBe(true);
  });
});
