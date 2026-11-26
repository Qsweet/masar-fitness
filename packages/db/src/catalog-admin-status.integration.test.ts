import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  createProduct,
  getCatalogProduct,
  listMembershipPlans,
  quoteCart,
  setAddonLinks,
  setProductStatus,
  staffActor,
  type CatalogProductDetail,
  type Db,
} from "./index";
import type { ProductStatusAction } from "@masar/domain";
import { productDraft } from "./test-support/catalog-admin-fixtures";
import { createTestClub, TEST_NOW } from "./test-support/commerce-fixtures";
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
const LATER = new Date(TEST_NOW.getTime() + MINUTE_MS);

let db: Db;
let other: Db;
let clubId: string;
let actor: ReturnType<typeof staffActor>;

async function detailOf(productId: string): Promise<CatalogProductDetail> {
  const detail = await getCatalogProduct(db, clubId, productId, LATER);
  if (detail === undefined) {
    throw new Error("المنتج غير موجود");
  }
  return detail;
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

function setStatus(
  product: CatalogProductDetail,
  action: ProductStatusAction,
  options: { confirmLast?: boolean; client?: Db; lockToken?: string } = {},
) {
  return setProductStatus(options.client ?? db, {
    productId: product.id,
    clubId,
    lockToken: options.lockToken ?? product.lockToken,
    action,
    confirmLast: options.confirmLast ?? false,
    actor,
    now: LATER,
  });
}

async function published(
  change: Parameters<typeof productDraft>[0] = {},
): Promise<CatalogProductDetail> {
  const product = await newProduct(change);
  unwrap(await setStatus(product, "publish"));
  return detailOf(product.id);
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
});

beforeEach(async () => {
  // نادٍ جديد لكل اختبار: عدّ «الباقات القابلة للبيع الأخرى» لكل نادٍ
  clubId = await createTestClub(db);
  actor = staffActor((await createTestStaff(db, clubId, { role: "manager" })).id);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

describe("setProductStatus: النشر", () => {
  it("مسودة مكتملة تُنشر فتُباع وتظهر في قائمة الموقع، مع سطر تدقيق بالحالتين", async () => {
    const product = await newProduct();
    expect((await listMembershipPlans(db, LATER)).some((plan) => plan.slug === product.slug)).toBe(
      false,
    );
    expect(unwrap(await setStatus(product, "publish"))).toEqual({
      status: "active",
      replayed: false,
      lastSellable: false,
    });
    const plans = await listMembershipPlans(db, LATER);
    expect(plans.find((plan) => plan.slug === product.slug)).toMatchObject({
      tier: { ar: "فئة الاختبار" },
      price: { amountMinor: 90_000 },
    });
    const audit = await db.auditLog.findFirst({
      where: { entityId: product.id, action: "product_published" },
    });
    expect(audit).toMatchObject({
      fromState: "draft",
      toState: "active",
      actor,
      entityType: "product",
    });
  });

  it("الإرسال الثاني: الرمز قديم فيُرفض، وبرمز جديد الحالة مطابقة فإعادة بلا تدقيق ثانٍ", async () => {
    const product = await newProduct();
    unwrap(await setStatus(product, "publish"));
    expect(failure(await setStatus(product, "publish")).reason).toBe("catalog.stale_edit");
    const fresh = await detailOf(product.id);
    expect(unwrap(await setStatus(fresh, "publish"))).toMatchObject({
      status: "active",
      replayed: true,
    });
    expect(
      await db.auditLog.count({ where: { entityId: product.id, action: "product_published" } }),
    ).toBe(1);
  });

  it("الملخص الناقص بإحدى اللغتين يمنع النشر", async () => {
    const product = await newProduct({ summaryEn: "" });
    const blocked = failure(await setStatus(product, "publish"));
    expect(blocked).toMatchObject({
      code: "conflict",
      reason: "catalog.publish_blocked.texts_incomplete",
    });
    expect((await detailOf(product.id)).status).toBe("draft");
  });

  it("منتج بلا نسخة سارية لا يُنشر", async () => {
    const product = await newProduct();
    await db.productVersion.updateMany({
      where: { productId: product.id },
      data: { validUntil: LATER },
    });
    const fresh = await detailOf(product.id);
    const blocked = failure(await setStatus(fresh, "publish"));
    expect(blocked.reason).toBe("catalog.publish_blocked.no_current_version");
  });

  it("إضافة بلا رابط تُنشر (تنبيه لا منع) ولا تُعرض حتى تُربط", async () => {
    const plan = await published();
    const addon = await newProduct({ kind: "addon" });
    expect(unwrap(await setStatus(addon, "publish")).status).toBe("active");
    const request = { planSlug: plan.slug, addonSlugs: [addon.slug], couponCode: null };
    expect(failure(await quoteCart(db, request, LATER)).reason).toBe("cart.addon_not_attachable");
    const fresh = await detailOf(addon.id);
    unwrap(
      await setAddonLinks(db, {
        productId: addon.id,
        clubId,
        lockToken: fresh.lockToken,
        membershipIds: [plan.id],
        actor,
        now: LATER,
      }),
    );
    expect(unwrap(await quoteCart(db, request, LATER)).total.amountMinor).toBe(180_000);
  });

  it("المؤرشف يُنشر من جديد ولا يُخفى", async () => {
    const product = await published();
    await published();
    unwrap(await setStatus(product, "archive"));
    const archived = await detailOf(product.id);
    expect(failure(await setStatus(archived, "unpublish")).reason).toBe(
      "catalog.status_not_allowed",
    );
    expect(unwrap(await setStatus(archived, "publish")).status).toBe("active");
  });
});

describe("setProductStatus: الإخفاء والأرشفة", () => {
  it.each([
    ["unpublish", "draft", "product_unpublished"],
    ["archive", "archived", "product_archived"],
  ] as const)("%s: يخرج من قائمة الموقع ومن السلة، بسطر تدقيق", async (action, status, audited) => {
    const product = await published();
    await published();
    expect(unwrap(await setStatus(product, action))).toEqual({
      status,
      replayed: false,
      lastSellable: false,
    });
    expect((await listMembershipPlans(db, LATER)).some((plan) => plan.slug === product.slug)).toBe(
      false,
    );
    const request = { planSlug: product.slug, addonSlugs: [], couponCode: null };
    expect(failure(await quoteCart(db, request, LATER)).reason).toBe("cart.product_unavailable");
    const audit = await db.auditLog.findFirst({ where: { entityId: product.id, action: audited } });
    expect(audit).toMatchObject({
      fromState: "active",
      toState: status,
      data: { lastSellable: false },
    });
  });

  it("طلب معلّق لا يُمس بإخفاء منتجه: يبقى بلقطته", async () => {
    const product = await published();
    await published();
    const input = orderInput(product.slug, 90_000, {
      buyer: testBuyer(testPhone(901)),
      now: LATER,
    });
    const order = unwrap(await createOrder(db, input));
    const fresh = await detailOf(product.id);
    expect(fresh.pendingOrders).toBe(1);
    unwrap(await setStatus(fresh, "archive"));
    const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(row).toMatchObject({ status: "pending_payment", totalMinor: 90_000 });
  });

  it("آخر باقة قابلة للبيع: تُرفض بلا تأكيد، وتُنفَّذ به ويُدقَّق", async () => {
    const only = await published();
    const draft = await newProduct();
    expect(draft.status).toBe("draft");
    const refused = failure(await setStatus(only, "unpublish"));
    expect(refused).toMatchObject({ code: "conflict", reason: "catalog.last_sellable_membership" });
    expect((await detailOf(only.id)).status).toBe("active");
    expect(unwrap(await setStatus(only, "archive", { confirmLast: true }))).toEqual({
      status: "archived",
      replayed: false,
      lastSellable: true,
    });
    const audit = await db.auditLog.findFirst({
      where: { entityId: only.id, action: "product_archived" },
    });
    expect(audit?.data).toMatchObject({ lastSellable: true });
  });

  it("أرشفة مسودة أو إضافة لا تسأل عن آخر باقة", async () => {
    await published();
    const draft = await newProduct();
    expect(unwrap(await setStatus(draft, "archive")).lastSellable).toBe(false);
    const addon = await published({ kind: "addon" });
    expect(unwrap(await setStatus(addon, "unpublish")).lastSellable).toBe(false);
  });

  it("سباق أرشفة آخر باقتين بلا تأكيد: واحدة تنجح والأخرى تُرفض، فتبقى باقة تُباع", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      clubId = await createTestClub(db);
      const [first, second] = [await published(), await published()];
      const results = await Promise.all([
        setStatus(first, "archive"),
        setStatus(second, "archive", { client: other }),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(refusalReasons(results)).toEqual(["catalog.last_sellable_membership"]);
      const statuses = await db.product.findMany({
        where: { id: { in: [first.id, second.id] } },
        select: { status: true },
      });
      expect(statuses.map((row) => row.status).sort()).toEqual(["active", "archived"]);
    }
  });
});
