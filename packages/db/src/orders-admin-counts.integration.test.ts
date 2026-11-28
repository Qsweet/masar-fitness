import { plainDate } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  countOrdersByTab,
  createDb,
  listOrders,
  listOrdersWithCounts,
  ORDER_LIST_TABS,
  type Db,
} from "./index";
import {
  createPlan,
  createTestClub,
  insertRawOrder,
  markRawPaid,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { testDatabaseUrl, testPhone } from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

/** عدّادات تبويبات الطلبات (القرار 92): استعلام واحد يطابق مجموع كل قائمة، في المدى نفسه. */
const HOUR_MS = 3_600_000;
const PLAN_PRICE = 90_000;
const EMPTY = { all: 0, awaiting: 0, paid: 0, expired: 0, cancelled: 0 };

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

async function seedTabs(): Promise<void> {
  await rawOrder();
  await rawOrder(new Date(TEST_NOW.getTime() - HOUR_MS));
  const paid = await rawOrder();
  await markRawPaid(db, paid.orderId, { paidAt: TEST_NOW });
  const cancelled = await rawOrder();
  await db.$executeRaw`UPDATE orders SET status = 'cancelled', cancelled_at = ${TEST_NOW}
    WHERE id = ${cancelled.orderId}::uuid`;
  await rawOrder(TEST_NOW, otherClubId, otherPlan);
}

describe("countOrdersByTab", () => {
  it("كل تبويب بعدد قائمته، والمعلّق بعد مهلته في «منتهية»، ونادٍ آخر لا يُحسب", async () => {
    await seedTabs();
    const counts = await countOrdersByTab(db, { clubId, now: TEST_NOW });
    expect(counts).toEqual({ all: 4, awaiting: 1, paid: 1, expired: 1, cancelled: 1 });
    for (const tab of ORDER_LIST_TABS) {
      const page = await listOrders(db, { clubId, tab, page: 1, pageSize: 25, now: TEST_NOW });
      expect(page.total, tab).toBe(counts[tab]);
    }
  });

  it("المدى بتقويم النادي يقيّد العدّ، ومدى بعيد صفر", async () => {
    await seedTabs();
    const farFuture = plainDate(2100, 1, 1);
    expect(await countOrdersByTab(db, { clubId, now: TEST_NOW, from: farFuture })).toEqual(EMPTY);
    expect(await countOrdersByTab(db, { clubId, now: TEST_NOW, to: farFuture })).toMatchObject({
      all: 4,
    });
  });
});

describe("listOrdersWithCounts", () => {
  it("الصفحة والعدّادات بحدّي المدى نفسيهما", async () => {
    await seedTabs();
    const query = { clubId, tab: "paid" as const, page: 1, pageSize: 25, now: TEST_NOW };
    const { page, counts } = await listOrdersWithCounts(db, query);
    expect(page).toEqual(await listOrders(db, query));
    expect(counts).toEqual(await countOrdersByTab(db, { clubId, now: TEST_NOW }));
  });
});
