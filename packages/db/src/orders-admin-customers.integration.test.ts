import { parseSaudiMobile, type SaudiMobile } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  findCustomerIdByPhone,
  getCustomerDetail,
  markOrderPaid,
  revealCustomerPhone,
  staffActor,
  type Db,
} from "./index";
import {
  createPlan,
  createTestClub,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  failure,
  orderInput,
  testBuyer,
  testDatabaseUrl,
  unwrap,
} from "./test-support/commerce-orders";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, type TestStaff } from "./test-support/staff-fixtures";

const PLAN_PRICE = 90_000;
const PHONE = "+966512345678";

let db: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let staff: TestStaff;

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PLAN_PRICE, durationMonths: 3 });
  staff = await createTestStaff(db, clubId, { role: "sales" });
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function mobile(input: string): SaudiMobile {
  return unwrap(parseSaudiMobile(input));
}

async function newOrder(phone = PHONE) {
  const input = orderInput(plan.slug, PLAN_PRICE, { buyer: testBuyer(phone) });
  const order = unwrap(await createOrder(db, input));
  const row = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
  return { orderId: order.orderId, customerId: row.customerId };
}

function reveals() {
  return db.auditLog.findMany({ where: { action: "phone_revealed" } });
}

describe("findCustomerIdByPhone: مطابقة تامة فقط", () => {
  it("الرقم كاملًا يطابق عميله، وبأي كتابة مقبولة له", async () => {
    const { customerId } = await newOrder();
    expect(await findCustomerIdByPhone(db, clubId, mobile(PHONE))).toBe(customerId);
    expect(await findCustomerIdByPhone(db, clubId, mobile("0512345678"))).toBe(customerId);
    expect(await findCustomerIdByPhone(db, clubId, mobile("٠٥١٢٣٤٥٦٧٨"))).toBe(customerId);
  });

  it("رقم يختلف بخانة واحدة أو يشترك في آخر الأرقام لا يطابق", async () => {
    await newOrder();
    expect(await findCustomerIdByPhone(db, clubId, mobile("+966512345679"))).toBeUndefined();
    expect(await findCustomerIdByPhone(db, clubId, mobile("+966599995678"))).toBeUndefined();
  });

  it("جزء من الرقم ليس جوالًا أصلًا: يُرفض قبل الاستعلام", () => {
    for (const partial of ["5678", "12345678", "+96651234", "0512"]) {
      expect(parseSaudiMobile(partial).ok).toBe(false);
    }
  });

  it("عميل نادٍ آخر لا يُرى", async () => {
    await newOrder();
    expect(await findCustomerIdByPhone(db, otherClubId, mobile(PHONE))).toBeUndefined();
  });
});

describe("getCustomerDetail", () => {
  it("جوال مقنَّع، وأول طلب، والاشتراك بحالته الفعلية، وبلا اسم", async () => {
    const { orderId, customerId } = await newOrder();
    unwrap(
      await markOrderPaid(db, {
        orderId,
        payment: {
          provider: "test_pay",
          providerPaymentId: "p-1",
          amountMinor: PLAN_PRICE,
          currency: "SAR",
        },
        actor: "provider",
        now: TEST_NOW,
      }),
    );
    const detail = await getCustomerDetail(db, clubId, customerId, TEST_NOW);
    expect(detail).toMatchObject({
      id: customerId,
      maskedPhone: "+966•••••5678",
      firstOrderAt: TEST_NOW,
      timeZone: "Asia/Riyadh",
      assessments: [],
    });
    expect(detail?.memberships).toHaveLength(1);
    expect(detail?.memberships[0]).toMatchObject({ orderId, status: "active", paidMonths: 3 });
    const serialised = JSON.stringify(detail);
    expect(serialised).not.toContain(PHONE);
    expect(serialised).not.toContain("عميل اختبار");
    // بعد نهاية الاشتراك يُعرض منتهيًا بلا كتابة
    const later = await getCustomerDetail(db, clubId, customerId, new Date("2027-01-01T00:00:00Z"));
    expect(later?.memberships[0]?.status).toBe("expired");
  });

  it("عميل من نادٍ آخر أو غير موجود: undefined", async () => {
    const { customerId } = await newOrder();
    expect(await getCustomerDetail(db, otherClubId, customerId, TEST_NOW)).toBeUndefined();
  });
});

describe("revealCustomerPhone: كل كشف مدقَّق", () => {
  it("من الطلب: يرجع الرقم ويكتب سطرًا بلا الرقم", async () => {
    const { orderId, customerId } = await newOrder();
    const revealed = unwrap(
      await revealCustomerPhone(db, {
        clubId,
        target: { source: "order", orderId },
        actor: staffActor(staff.id),
        now: TEST_NOW,
      }),
    );
    expect(revealed).toEqual({ customerId, phoneE164: PHONE });
    const rows = await reveals();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: "customer",
      entityId: customerId,
      actor: `staff:${staff.id}`,
      data: { source: "order", orderId },
    });
    expect(JSON.stringify(rows)).not.toContain("512345678");
  });

  it("من صفحة العميل: سطر لكل كشف، ولا يُدمج المكرر", async () => {
    const { customerId } = await newOrder();
    const input = {
      clubId,
      target: { source: "customer", customerId },
      actor: staffActor(staff.id),
      now: TEST_NOW,
    } as const;
    unwrap(await revealCustomerPhone(db, input));
    unwrap(await revealCustomerPhone(db, input));
    const rows = await reveals();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.data).toEqual({ source: "customer", orderId: null });
  });

  it("فشل سطر التدقيق يمنع إرجاع الرقم", async () => {
    const { customerId } = await newOrder();
    const attempt = revealCustomerPhone(db, {
      clubId,
      target: { source: "customer", customerId },
      // فاعل بغير شكله ترفضه القاعدة (audit_logs_actor_known)
      actor: "staff:not-a-uuid",
      now: TEST_NOW,
    });
    await expect(attempt).rejects.toThrow("audit_logs_actor_known");
    expect(await reveals()).toHaveLength(0);
  });

  it("طلب أو عميل من نادٍ آخر: not_found بلا سطر", async () => {
    const { orderId, customerId } = await newOrder();
    const actor = staffActor(staff.id);
    const byOrder = await revealCustomerPhone(db, {
      clubId: otherClubId,
      target: { source: "order", orderId },
      actor,
      now: TEST_NOW,
    });
    const byCustomer = await revealCustomerPhone(db, {
      clubId: otherClubId,
      target: { source: "customer", customerId },
      actor,
      now: TEST_NOW,
    });
    expect(failure(byOrder)).toMatchObject({ code: "not_found", reason: "customer.not_found" });
    expect(failure(byCustomer)).toMatchObject({ reason: "customer.not_found" });
    expect(await reveals()).toHaveLength(0);
  });
});
