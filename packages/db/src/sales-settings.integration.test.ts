import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  getSalesSettings,
  quoteCart,
  staffActor,
  updateSalesSettings,
  type Db,
} from "./index";
import { createPlan, createTestClub, TEST_NOW } from "./test-support/commerce-fixtures";
import {
  createDbClients,
  disconnectAll,
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  testPhone,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const PRICE = 90_000;
const MINUTE_MS = 60_000;
const LATER = new Date(TEST_NOW.getTime() + MINUTE_MS);

let db: Db;
let other: Db;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

async function setup(policy: Parameters<typeof createTestClub>[1] = {}) {
  const clubId = await createTestClub(db, policy);
  const plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 1 });
  const actor = staffActor((await createTestStaff(db, clubId, { role: "owner" })).id);
  return { clubId, plan, actor };
}

describe("getSalesSettings و updateSalesSettings", () => {
  it("غير المحسوم يُقرأ null، والشراء ممنوع به كما هو", async () => {
    const { clubId, plan } = await setup({
      orderPaymentWindowMinutes: null,
      membershipStartRule: null,
    });
    expect(await getSalesSettings(db, clubId)).toMatchObject({
      orderPaymentWindowMinutes: null,
      membershipStartRule: null,
      vatRateBps: 1500,
      currency: "SAR",
      timezone: "Asia/Riyadh",
    });
    const quote = unwrap(
      await quoteCart(db, { planSlug: plan.slug, addonSlugs: [], couponCode: null }, LATER),
    );
    expect(quote.blockers).toEqual(["order_payment_window", "membership_start_rule"]);
    const refused = failure(await createOrder(db, orderInput(plan.slug, PRICE, { now: LATER })));
    expect(refused.reason).toBe("policy.undecided.order_payment_window");
  });

  it("الكتابة تفتح الشراء وتكتب سطر تدقيق بالقديم والجديد باسم الموظف", async () => {
    const { clubId, plan, actor } = await setup({
      orderPaymentWindowMinutes: null,
      membershipStartRule: null,
    });
    const { lockToken } = await getSalesSettings(db, clubId);
    const settings = {
      orderPaymentWindowMinutes: 1440,
      membershipStartRule: "on_payment",
    } as const;
    const updated = await updateSalesSettings(db, {
      clubId,
      lockToken,
      settings,
      actor,
      now: LATER,
    });
    expect(unwrap(updated)).toEqual({ changed: true });
    expect(await getSalesSettings(db, clubId)).toMatchObject(settings);
    const order = unwrap(
      await createOrder(
        db,
        orderInput(plan.slug, PRICE, { buyer: testBuyer(testPhone(701)), now: LATER }),
      ),
    );
    const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(1440 * MINUTE_MS);
    const [audit] = await db.auditLog.findMany({ where: { entityType: "club", entityId: clubId } });
    expect(audit).toMatchObject({
      action: "sales_settings_updated",
      actor,
      data: {
        windowBefore: null,
        windowAfter: 1440,
        startRuleBefore: null,
        startRuleAfter: "on_payment",
      },
    });
  });

  it("طلب قائم لا يتغير: مهلته وقاعدته مختومتان عليه", async () => {
    const { clubId, plan, actor } = await setup();
    const before = unwrap(
      await createOrder(db, orderInput(plan.slug, PRICE, { buyer: testBuyer(testPhone(702)) })),
    );
    const snapshot = await db.order.findUniqueOrThrow({
      where: { id: before.orderId },
      include: { items: true },
    });
    const { lockToken } = await getSalesSettings(db, clubId);
    const settings = {
      orderPaymentWindowMinutes: 60,
      membershipStartRule: "on_first_visit",
    } as const;
    unwrap(await updateSalesSettings(db, { clubId, lockToken, settings, actor, now: LATER }));
    const after = await db.order.findUniqueOrThrow({
      where: { id: before.orderId },
      include: { items: true },
    });
    expect(after.expiresAt).toEqual(snapshot.expiresAt);
    expect(after.items[0]?.membershipStartRule).toBe("on_payment");
    const next = unwrap(
      await createOrder(
        db,
        orderInput(plan.slug, PRICE, { buyer: testBuyer(testPhone(703)), now: LATER }),
      ),
    );
    const created = await db.order.findUniqueOrThrow({
      where: { id: next.orderId },
      include: { items: true },
    });
    expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(60 * MINUTE_MS);
    expect(created.items[0]?.membershipStartRule).toBe("on_first_visit");
  });

  it("لا فرق ⇒ لا كتابة ولا تدقيق؛ ورمز قفل قديم مرفوض", async () => {
    const { clubId, actor } = await setup();
    const current = await getSalesSettings(db, clubId);
    const same = { orderPaymentWindowMinutes: 30, membershipStartRule: "on_payment" } as const;
    const base = { clubId, lockToken: current.lockToken, actor, now: LATER };
    expect(unwrap(await updateSalesSettings(db, { ...base, settings: same }))).toEqual({
      changed: false,
    });
    expect(await db.auditLog.count({ where: { entityId: clubId } })).toBe(0);
    const changed = { ...same, orderPaymentWindowMinutes: 45 };
    unwrap(await updateSalesSettings(db, { ...base, settings: changed }));
    const stale = failure(
      await updateSalesSettings(db, {
        ...base,
        settings: { ...same, orderPaymentWindowMinutes: 50 },
      }),
    );
    expect(stale).toMatchObject({ code: "conflict", reason: "sales_settings.stale_edit" });
    expect((await getSalesSettings(db, clubId)).orderPaymentWindowMinutes).toBe(45);
  });

  it("حفظان متزامنان بالرمز نفسه: واحد ينجح والآخر يُرفض", async () => {
    const { clubId, actor } = await setup();
    const { lockToken } = await getSalesSettings(db, clubId);
    const save = (client: Db, minutes: number) =>
      updateSalesSettings(client, {
        clubId,
        lockToken,
        settings: { orderPaymentWindowMinutes: minutes, membershipStartRule: "on_payment" },
        actor,
        now: LATER,
      });
    const results = await Promise.all([save(db, 40), save(other, 50)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: clubId } })).toBe(1);
  });
});
