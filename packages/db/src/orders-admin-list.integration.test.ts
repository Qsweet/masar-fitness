import { plainDate } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  getOrderDetail,
  listOrders,
  type Db,
  type OrderListQuery,
  type OrderListTab,
} from "./index";
import {
  createPlan,
  createTestClub,
  expireRawOrder,
  insertRawOrder,
  markRawPaid,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { orderInput, testDatabaseUrl, testPhone, unwrap } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const PLAN_PRICE = 90_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const FULL_PHONE = "+966512345678";

let db: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let otherPlan: TestProduct;
let phoneIndex = 0;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 3 });
  otherPlan = await createPlan(db, otherClubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function rawOrder(createdAt = TEST_NOW, club = clubId, product = plan) {
  phoneIndex += 1;
  return insertRawOrder(db, {
    clubId: club,
    lines: [{ product }],
    phone: testPhone(phoneIndex),
    createdAt,
  });
}

function list(overrides: Partial<OrderListQuery> = {}) {
  return listOrders(db, {
    clubId,
    tab: "all",
    page: 1,
    pageSize: 25,
    now: TEST_NOW,
    ...overrides,
  });
}

async function referencesIn(tab: OrderListTab, now = TEST_NOW): Promise<string[]> {
  const page = await list({ tab, now });
  return page.rows.map((row) => row.reference).sort();
}

async function referenceOf(orderId: string): Promise<string> {
  return (await db.order.findUniqueOrThrow({ where: { id: orderId } })).reference;
}

describe("listOrders: التبويب بالحالة الفعلية", () => {
  it("كل طلب في تبويبه، والمعلّق الذي بلغ مهلته في «منتهية» وإن لم يُكتب", async () => {
    const awaiting = await rawOrder();
    const lapsed = await rawOrder(new Date(TEST_NOW.getTime() - HOUR_MS));
    const paid = await rawOrder();
    await markRawPaid(db, paid.orderId, { paidAt: TEST_NOW });
    const fulfilled = await rawOrder();
    await markRawPaid(db, fulfilled.orderId, { paidAt: TEST_NOW });
    await db.$executeRaw`UPDATE orders SET status = 'fulfilled', fulfilled_at = ${TEST_NOW}
      WHERE id = ${fulfilled.orderId}::uuid`;
    const expired = await rawOrder();
    await expireRawOrder(db, expired.orderId);
    const cancelled = await rawOrder();
    await db.$executeRaw`UPDATE orders SET status = 'cancelled', cancelled_at = ${TEST_NOW}
      WHERE id = ${cancelled.orderId}::uuid`;
    const ref = (order: { orderId: string }) => referenceOf(order.orderId);

    expect(await referencesIn("awaiting")).toEqual([await ref(awaiting)]);
    expect(await referencesIn("paid")).toEqual([await ref(paid), await ref(fulfilled)].sort());
    expect(await referencesIn("expired")).toEqual([await ref(lapsed), await ref(expired)].sort());
    expect(await referencesIn("cancelled")).toEqual([await ref(cancelled)]);
    expect(await referencesIn("all")).toHaveLength(6);

    const statuses = new Map((await list()).rows.map((row) => [row.id, row.status]));
    expect(statuses.get(lapsed.orderId)).toBe("expired");
    expect(statuses.get(awaiting.orderId)).toBe("pending_payment");
    // بعد مهلة الطلب المعلّق ينتقل وحده إلى «منتهية» بلا كتابة
    const later = new Date(TEST_NOW.getTime() + HOUR_MS);
    expect(await referencesIn("awaiting", later)).toEqual([]);
    expect(await referencesIn("expired", later)).toHaveLength(3);
  });

  it("طريقة الدفع والسطر الأساسي وعدد السطور والإجمالي من اللقطة", async () => {
    const order = await rawOrder();
    await markRawPaid(db, order.orderId, { paidAt: TEST_NOW, provider: "test_pay" });
    const [row] = (await list()).rows;
    expect(row).toMatchObject({
      id: order.orderId,
      customerName: "عميل اختبار",
      itemName: { ar: "منتج", en: "Product" },
      itemCount: 1,
      paidProvider: "test_pay",
      status: "paid",
    });
    expect(row?.total.amountMinor).toBe(PLAN_PRICE);
    expect(row?.reference).toMatch(/^MSR-\d{7}$/);
  });
});

describe("listOrders: المدى بتقويم النادي", () => {
  it("حدود اليوم بتوقيت الرياض لا UTC، والطرفان مشمولان", async () => {
    // 15 يونيو بتوقيت الرياض يبدأ 21:00Z يوم 14 وينتهي 21:00Z يوم 15
    const before = await rawOrder(new Date("2026-06-14T20:59:59Z"));
    const first = await rawOrder(new Date("2026-06-14T21:00:00Z"));
    const last = await rawOrder(new Date("2026-06-15T20:59:59Z"));
    const after = await rawOrder(new Date("2026-06-15T21:00:00Z"));
    const day = plainDate(2026, 6, 15);
    const now = new Date("2026-06-16T09:00:00Z");
    const ids = async (query: Partial<OrderListQuery>) =>
      (await list({ now, ...query })).rows.map((row) => row.id).sort();

    expect(await ids({ from: day, to: day })).toEqual([first.orderId, last.orderId].sort());
    expect(await ids({ from: day })).toEqual([first.orderId, last.orderId, after.orderId].sort());
    expect(await ids({ to: plainDate(2026, 6, 14) })).toEqual([before.orderId]);
    expect(await ids({})).toHaveLength(4);
    expect(await ids({ from: plainDate(2026, 6, 17) })).toEqual([]);
  });
});

describe("listOrders: البحث والصفحات والعزل", () => {
  it("البحث بالمرجع مطابقة تامة", async () => {
    const order = await rawOrder();
    await rawOrder();
    const reference = await referenceOf(order.orderId);
    const found = await list({ reference });
    expect(found.total).toBe(1);
    expect(found.rows[0]?.id).toBe(order.orderId);
    expect((await list({ reference: reference.slice(0, -1) })).total).toBe(0);
    expect((await list({ reference: "MSR-9999999" })).total).toBe(0);
  });

  it("الأحدث أولًا، والصفحات تقسم المجموع بلا تكرار ولا نقص", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const order = await rawOrder(new Date(TEST_NOW.getTime() - index * MINUTE_MS));
      ids.push(order.orderId);
    }
    const first = await list({ pageSize: 2 });
    const second = await list({ pageSize: 2, page: 2 });
    const third = await list({ pageSize: 2, page: 3 });
    expect(first.total).toBe(5);
    expect([...first.rows, ...second.rows, ...third.rows].map((row) => row.id)).toEqual(ids);
    expect((await list({ pageSize: 2, page: 4 })).rows).toEqual([]);
  });

  it("طلبات نادٍ آخر لا تظهر، ولا بمرجعها ولا بمعرّف عميلها", async () => {
    const mine = await rawOrder();
    const theirs = await rawOrder(TEST_NOW, otherClubId, otherPlan);
    expect((await list()).rows.map((row) => row.id)).toEqual([mine.orderId]);
    const reference = await referenceOf(theirs.orderId);
    expect((await list({ reference })).total).toBe(0);
    expect((await list({ customerId: theirs.customerId })).total).toBe(0);
    expect((await list({ clubId: otherClubId })).rows.map((row) => row.id)).toEqual([
      theirs.orderId,
    ]);
    expect(await getOrderDetail(db, clubId, theirs.orderId, TEST_NOW)).toBeUndefined();
  });

  it("طلبات عميل واحد", async () => {
    const first = await rawOrder();
    await rawOrder();
    const page = await list({ customerId: first.customerId });
    expect(page.rows.map((row) => row.id)).toEqual([first.orderId]);
  });

  it("الجوال الكامل لا يخرج: آخر أربعة أرقام فقط في القائمة والتفصيل", async () => {
    const order = await insertRawOrder(db, {
      clubId,
      lines: [{ product: plan }],
      phone: FULL_PHONE,
    });
    const page = await list();
    const detail = await getOrderDetail(db, clubId, order.orderId, TEST_NOW);
    expect(page.rows[0]?.maskedPhone).toBe("+966•••••5678");
    expect(detail?.order.maskedPhone).toBe("+966•••••5678");
    const serialised = JSON.stringify([page, detail]);
    expect(serialised).not.toContain(FULL_PHONE);
    expect(serialised).not.toContain("512345678");
  });
});

describe("getOrderDetail: من اللقطة", () => {
  it("تعديل المنتج وأرشفته بعد الطلب لا يغيّر ما يُعرض", async () => {
    const created = unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    const before = await getOrderDetail(db, clubId, created.orderId, TEST_NOW);
    await db.product.update({
      where: { id: plan.productId },
      data: { nameAr: "اسم جديد", nameEn: "Renamed", status: "archived" },
    });
    const after = await getOrderDetail(db, clubId, created.orderId, TEST_NOW);
    await db.product.update({
      where: { id: plan.productId },
      data: { nameAr: "منتج اختبار", nameEn: "Test product", status: "active" },
    });
    expect(after?.order.items).toEqual(before?.order.items);
    expect(after?.order.items[0]?.name).toEqual({ ar: "منتج اختبار", en: "Test product" });
    expect(after?.order.total.amountMinor).toBe(PLAN_PRICE);
  });

  it("طلب معلّق: بلا دفع ولا اشتراك، وخطه الزمني يبدأ بإنشائه", async () => {
    const created = unwrap(await createOrder(db, orderInput(plan.slug, PLAN_PRICE)));
    const detail = await getOrderDetail(db, clubId, created.orderId, TEST_NOW);
    expect(detail).toMatchObject({
      payment: null,
      membership: null,
      manualPayment: null,
      attempts: [],
      incidents: [],
      refunds: [],
      cancelledAt: null,
    });
    expect(detail?.order.effectiveStatus).toBe("pending_payment");
    expect(detail?.timeline.map((entry) => entry.action)).toEqual(["order_created"]);
    const lapsed = await getOrderDetail(
      db,
      clubId,
      created.orderId,
      new Date(TEST_NOW.getTime() + HOUR_MS),
    );
    expect(lapsed?.order.effectiveStatus).toBe("expired");
    expect(lapsed?.order.status).toBe("pending_payment");
  });

  it("معرّف غير موجود: undefined", async () => {
    const missing = "018f4e2a-7b1c-7d3e-9f4a-5b6c7d8e9f01";
    expect(await getOrderDetail(db, clubId, missing, TEST_NOW)).toBeUndefined();
  });
});
