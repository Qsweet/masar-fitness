import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createAssessmentRequest,
  createDb,
  createOrder,
  expireAllDueOrders,
  expireDueOrders,
  type Db,
} from "./index";
import {
  createAssessedService,
  createPlan,
  createTestClub,
  expiryAfter,
  markRawPaid,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";

const run = promisify(execFile);
const PLAN_PRICE = 90_000;
const DEADLINE = expiryAfter(TEST_NOW);
const SCRIPT_TIMEOUT_MS = 60_000;

let db: Db;
let plan: TestProduct;
let service: TestProduct;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  const clubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 1 });
  service = await createAssessedService(db, clubId, { priceMinor: PLAN_PRICE });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, assessment_requests, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function newOrder(phoneIndex = 0): Promise<string> {
  const input = orderInput(plan.slug, PLAN_PRICE, { buyer: testBuyer(testPhone(phoneIndex)) });
  return unwrap(await createOrder(db, input)).orderId;
}

function statusOf(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId } }).then((order) => order.status);
}

describe("expireDueOrders", () => {
  it("لا يسبق المهلة، وتشغيله مرتين بلا أثر ثانٍ", async () => {
    const orderId = await newOrder();
    const early = new Date(DEADLINE.getTime() - 1);
    expect(await expireDueOrders(db, { now: early, limit: 10 })).toBe(0);
    expect(await expireDueOrders(db, { now: DEADLINE, limit: 10 })).toBe(1);
    expect(await expireDueOrders(db, { now: DEADLINE, limit: 10 })).toBe(0);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: "expired", expiredAt: DEADLINE });
    const audit = await db.auditLog.findMany({
      where: { entityId: orderId, action: "order_expired" },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ fromState: "pending_payment", toState: "expired" });
  });

  it("لا يمسّ المدفوع، ويحترم الحد والنطاق", async () => {
    const paid = await newOrder(1);
    await markRawPaid(db, paid, { paidAt: TEST_NOW });
    const first = await newOrder(2);
    const second = await newOrder(3);
    const customer = await db.order.findUniqueOrThrow({ where: { id: second } });
    const scoped = { now: DEADLINE, limit: 10, customerId: customer.customerId, promotionIds: [] };
    expect(await expireDueOrders(db, scoped)).toBe(1);
    expect(await statusOf(first)).toBe("pending_payment");
    expect(await expireDueOrders(db, { now: DEADLINE, limit: 1 })).toBe(1);
    expect(await statusOf(paid)).toBe("paid");
    expect(await statusOf(first)).toBe("expired");
  });

  it("يتخطى الطلب المقفل ولا ينتظره", async () => {
    const orderId = await newOrder();
    const other = createDb(testDatabaseUrl());
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    let signalLocked = (): void => undefined;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    const holder = other.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id::text FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      signalLocked();
      await held;
    });
    await locked;
    expect(await expireDueOrders(db, { now: DEADLINE, limit: 10 })).toBe(0);
    release();
    await holder;
    await other.$disconnect();
    expect(await expireDueOrders(db, { now: DEADLINE, limit: 10 })).toBe(1);
  });

  it("expireAllDueOrders يكرر الدفعات حتى لا يبقى مستحق، لا دفعة واحدة", async () => {
    const overdue = 5;
    const batch = 2;
    const ids: string[] = [];
    for (let index = 0; index < overdue; index += 1) {
      ids.push(await newOrder(index));
    }
    expect(await expireAllDueOrders(db, { now: DEADLINE, limit: batch })).toBe(overdue);
    const statuses = await Promise.all(ids.map(statusOf));
    expect(new Set(statuses)).toEqual(new Set(["expired"]));
    expect(await expireAllDueOrders(db, { now: DEADLINE, limit: batch })).toBe(0);
  });

  it("سكربت orders:expire يُنهي المستحق بدفعات ويطبع العدد", async () => {
    const orderId = await newOrder();
    const { stdout } = await run("pnpm", ["--silent", "orders:expire"], {
      timeout: SCRIPT_TIMEOUT_MS,
    });
    expect(stdout).toMatch(/^Expired \d+ overdue orders\.\n$/);
    expect(await statusOf(orderId)).toBe("expired");
  });
});

describe("createAssessmentRequest", () => {
  const command = () => ({
    productSlug: service.slug,
    buyer: testBuyer(),
    locale: "ar" as const,
    idempotencyKey: randomUUID(),
    now: TEST_NOW,
  });

  it("صف واحد عند التكرار، وسطر تدقيق بلا جوال", async () => {
    const input = command();
    const first = unwrap(await createAssessmentRequest(db, input));
    const again = unwrap(await createAssessmentRequest(db, input));
    expect(again).toEqual({ id: first.id, replayed: true });
    expect(first.replayed).toBe(false);
    expect(await db.assessmentRequest.count()).toBe(1);
    const audit = await db.auditLog.findMany({ where: { entityId: first.id } });
    expect(audit.map((row) => [row.entityType, row.action, row.actor])).toEqual([
      ["assessment_request", "assessment_requested", "customer"],
    ]);
    expect(JSON.stringify(audit[0]?.data)).not.toContain(input.buyer.mobile);
  });

  it("المفتاح نفسه ببيانات أخرى تعارض، ومنتج غير خدمة بتقييم غير موجود", async () => {
    const input = command();
    unwrap(await createAssessmentRequest(db, input));
    const reused = failure(
      await createAssessmentRequest(db, { ...input, buyer: testBuyer(testPhone(5)) }),
    );
    expect(reused).toMatchObject({ code: "conflict", reason: "assessment.idempotency_key_reused" });
    const membership = failure(
      await createAssessmentRequest(db, { ...command(), productSlug: plan.slug }),
    );
    expect(membership).toMatchObject({
      code: "not_found",
      reason: "assessment.product_unavailable",
    });
    expect(await db.assessmentRequest.count()).toBe(1);
  });
});

it("البذرة التجريبية تُشغَّل مرتين بلا خطأ", async () => {
  const env = { ...process.env, SEED_DEMO_DATA: "yes" };
  for (let pass = 0; pass < 2; pass += 1) {
    const { stdout } = await run("pnpm", ["--silent", "seed:demo"], {
      env,
      timeout: SCRIPT_TIMEOUT_MS,
    });
    expect(stdout).toMatch(/^Seeded /);
  }
});
