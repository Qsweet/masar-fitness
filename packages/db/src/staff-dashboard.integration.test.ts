import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countAwaitingPayment,
  createDb,
  findClubSummary,
  listRecentOrders,
  staffMfaCoverage,
  type ClubSummary,
  type Db,
} from "./index";
import {
  createDigitalProgram,
  createTestClub,
  insertRawOrder,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

/** منتصف نهار 26 نوفمبر في الرياض (UTC+3). منتصف ليل الرياض هو 21:00 UTC من اليوم السابق. */
const NOW = new Date("2026-11-26T09:00:00Z");
const PRICE_MINOR = 15_000;
const HOUR_MS = 3_600_000;

let db: Db;
let club: ClubSummary;
let program: TestProduct;

async function order(createdAt: string, phone: string, paidAt?: string): Promise<string> {
  const created = new Date(createdAt);
  const raw = await insertRawOrder(db, {
    clubId: club.id,
    lines: [{ product: program }],
    phone,
    createdAt: created,
    expiresAt: new Date(created.getTime() + HOUR_MS),
  });
  if (paidAt !== undefined) {
    await db.order.update({
      where: { id: raw.orderId },
      data: {
        status: "paid",
        paidAt: new Date(paidAt),
        paidProvider: "fake",
        paidProviderPaymentId: `pay-${raw.orderId}`,
        paidAmountMinor: PRICE_MINOR,
        paidCurrency: "SAR",
      },
    });
  }
  return raw.orderId;
}

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
  const summary = await findClubSummary(db, await createTestClub(db));
  if (summary === null) {
    throw new Error("نادي الاختبار لم يُنشأ");
  }
  club = summary;
  program = await createDigitalProgram(db, club.id, { priceMinor: PRICE_MINOR });
  // أمس (25): طلبان، دُفع أحدهما اليوم. اليوم (26): ثلاثة، دُفع واحد، وواحد بلغ مهلته، وواحد ينتظر.
  await order("2026-11-24T20:59:59Z", "+966500000001");
  await order("2026-11-24T21:00:00Z", "+966500000002", "2026-11-24T22:00:00Z");
  await order("2026-11-25T10:00:00Z", "+966500000003", "2026-11-25T21:30:00Z");
  await order("2026-11-25T21:00:00Z", "+966500000004", "2026-11-25T21:10:00Z");
  await order("2026-11-26T07:00:00Z", "+966500000005");
  await order("2026-11-26T08:30:00Z", "+966500001234");
  // في المستقبل نسبةً إلى NOW: لا يُعدّ
  await order("2026-11-26T09:30:00Z", "+966500000007");
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

describe("ما ينتظر الدفع وآخر الطلبات", () => {
  it("المعلّق الذي لم يبلغ مهلته وحده ينتظر الدفع", async () => {
    // طلب 08:30 مهلته 09:30 (ينتظر)، وطلب 07:00 بلغ مهلته 08:00، وطلب 09:30 مستقبلي معلّق أيضًا
    expect(await countAwaitingPayment(db, club.id, NOW)).toBe(2);
    expect(await countAwaitingPayment(db, club.id, new Date(NOW.getTime() + 2 * HOUR_MS))).toBe(0);
  });

  it("الأحدث أولًا، بآخر أربعة أرقام من الجوال فقط، وبالحالة كما تُعرض", async () => {
    const orders = await listRecentOrders(db, club.id, NOW, 3);
    expect(orders.map((entry) => entry.phoneLast4)).toEqual(["1234", "0005", "0004"]);
    expect(orders.map((entry) => entry.status)).toEqual(["pending_payment", "expired", "paid"]);
    expect(orders[0]).toMatchObject({ totalMinor: PRICE_MINOR, currency: "SAR" });
    expect(orders[0]?.reference).toMatch(/^MSR-[0-9]{7,}$/);
    expect(orders[0]?.itemNameAr).not.toBe("");
    expect(JSON.stringify(orders)).not.toContain("+9665");
  });
});

describe("تغطية التحقق بخطوتين", () => {
  it("تعدّ الحسابات النشطة ومن فعّل منها", async () => {
    await createTestStaff(db, club.id, { withTotp: true });
    await createTestStaff(db, club.id, { role: "sales" });
    await createTestStaff(db, club.id, { role: "editor", status: "disabled", withTotp: true });
    expect(await staffMfaCoverage(db, club.id)).toEqual({ active: 2, enrolled: 1 });
  });
});
