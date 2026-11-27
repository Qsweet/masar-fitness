import { parseRange, type DateRange } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clubHasOrders,
  createDb,
  periodDailySeries,
  periodFunnel,
  periodSalesByPlan,
  type Db,
} from "./index";
import {
  createDigitalProgram,
  createTestClub,
  insertRawOrder,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { insertRawAttempt, setRawAttempt } from "./test-support/payments-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

/**
 * قراءات «نظرة عامة» v2 لفترة (ADMIN_REDESIGN §5.1، R2): الأرقام تطابق ما حُسب يدويًا هنا لطلبات حول
 * منتصف الليل بتوقيت الرياض، والفترة السابقة مقصوصة إلى الزمن المنقضي نفسه. الوقت مثبَّت بلحظة من
 * التطبيق (لا `NOW()` القاعدة). منتصف ليل الرياض هو 21:00 UTC من اليوم السابق.
 */
const RIYADH = "Asia/Riyadh";
const NOW = new Date("2026-11-26T09:00:00Z");
const P1_MINOR = 15_000;
const P2_MINOR = 30_000;
const HOUR_MS = 3_600_000;

/** نهاية المحاولة بنص SQL ثابت: فشل بسبب، أو انقضاء المهلة بلا دفع. */
const ATTEMPT_ENDINGS = {
  failed: [
    "status = 'failed', failure_reason = 'provider_unreachable', ended_at = deadline_at, updated_at = deadline_at",
  ],
  // الانقضاء من محاولة بدأت عند المزوّد فقط (pending)
  expired: [
    "status = 'pending', provider_session_id = gen_random_uuid()::text",
    "status = 'expired', ended_at = deadline_at, updated_at = deadline_at",
  ],
} as const;

let db: Db;
let clubId: string;
let otherClubId: string;
let p1: TestProduct;
let p2: TestProduct;

interface Seed {
  readonly created: string;
  readonly paid?: string;
  readonly product?: TestProduct;
  readonly attempt?: "failed" | "expired";
  readonly club?: string;
}

async function seed({ created, paid, product = p1, attempt, club = clubId }: Seed): Promise<void> {
  const createdAt = new Date(created);
  const raw = await insertRawOrder(db, {
    clubId: club,
    lines: [{ product }],
    createdAt,
    expiresAt: new Date(createdAt.getTime() + HOUR_MS),
  });
  if (attempt !== undefined) {
    const record = await insertRawAttempt(db, {
      clubId: club,
      orderId: raw.orderId,
      amountMinor: product.priceMinor,
      createdAt,
      updatedAt: createdAt,
      deadlineAt: new Date(createdAt.getTime() + HOUR_MS / 2),
    });
    for (const assignment of ATTEMPT_ENDINGS[attempt]) {
      await setRawAttempt(db, record.id, assignment);
    }
  }
  if (paid !== undefined) {
    await db.order.update({
      where: { id: raw.orderId },
      data: {
        status: "paid",
        paidAt: new Date(paid),
        paidProvider: "fake",
        paidProviderPaymentId: `pay-${raw.orderId}`,
        paidAmountMinor: product.priceMinor,
        paidCurrency: "SAR",
      },
    });
  }
}

function range(input: Parameters<typeof parseRange>[0]): DateRange {
  return parseRange(input, NOW, RIYADH).range;
}

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  p1 = await createDigitalProgram(db, clubId, { priceMinor: P1_MINOR });
  p2 = await createDigitalProgram(db, clubId, { priceMinor: P2_MINOR });
  const other = await createDigitalProgram(db, otherClubId, { priceMinor: P1_MINOR });
  // أمس صباحًا (داخل الزمن المنقضي المقارَن) وبعد ظهر أمس (خارجه)
  await seed({ created: "2026-11-25T08:00:00Z", paid: "2026-11-25T08:30:00Z" });
  await seed({ created: "2026-11-25T10:00:00Z", paid: "2026-11-25T10:10:00Z" });
  // أُنشئ قبل منتصف ليل الرياض بثانية، ودُفع بعده: إنشاء أمس، ودفع اليوم
  await seed({ created: "2026-11-25T20:59:59Z", paid: "2026-11-25T21:00:30Z" });
  // اليوم: مدفوع، وفشلت محاولته، وانتهت مهلته بعد محاولة، وبلا محاولة، ومدفوع يدويًا بلا محاولة
  await seed({ created: "2026-11-25T21:00:00Z", paid: "2026-11-25T21:10:00Z" });
  await seed({ created: "2026-11-26T06:00:00Z", attempt: "failed" });
  await seed({ created: "2026-11-26T07:00:00Z", attempt: "expired" });
  await seed({ created: "2026-11-26T08:30:00Z" });
  await seed({ created: "2026-11-26T08:00:00Z", paid: "2026-11-26T08:10:00Z", product: p2 });
  // بعد NOW، ونادٍ آخر: لا يُعدّان
  await seed({ created: "2026-11-26T09:30:00Z", paid: "2026-11-26T09:40:00Z" });
  await seed({
    created: "2026-11-26T05:00:00Z",
    paid: "2026-11-26T05:10:00Z",
    product: other,
    club: otherClubId,
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("periodDailySeries", () => {
  it("اليوم بتقويم الرياض: الإيراد بيوم الدفع، والإنشاء بيوم الإنشاء", async () => {
    const today = range({ range: "today" });
    expect(await periodDailySeries(db, clubId, RIYADH, today)).toEqual([
      { day: "2026-11-26", revenueMinor: 60_000, paid: 3, created: 5, createdPaid: 2 },
    ]);
  });

  it("الفترة السابقة مقصوصة إلى الزمن المنقضي نفسه: صباح أمس فقط", async () => {
    const { previous } = range({ range: "today" });
    expect(await periodDailySeries(db, clubId, RIYADH, previous)).toEqual([
      { day: "2026-11-25", revenueMinor: P1_MINOR, paid: 1, created: 1, createdPaid: 1 },
    ]);
  });

  it("سبعة أيام: كل يوم حاضر ولو بلا طلبات، والأقدم أولًا", async () => {
    const days = await periodDailySeries(db, clubId, RIYADH, range({ range: "7d" }));
    expect(days.map((day) => day.day)).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
    ]);
    expect(days[0]).toEqual({
      day: "2026-11-20",
      revenueMinor: 0,
      paid: 0,
      created: 0,
      createdPaid: 0,
    });
    expect(days[5]).toEqual({
      day: "2026-11-25",
      revenueMinor: 2 * P1_MINOR,
      paid: 2,
      created: 3,
      createdPaid: 3,
    });
  });
});

describe("periodSalesByPlan وperiodFunnel", () => {
  it("المدفوع اليوم مجمَّعًا بالسطر الأول، والأكبر مبلغًا ثم عددًا أولًا", async () => {
    const sales = await periodSalesByPlan(db, clubId, range({ range: "today" }));
    expect(sales.map((row) => [row.productId, row.orders, row.revenueMinor])).toEqual([
      [p1.productId, 2, 2 * P1_MINOR],
      [p2.productId, 1, P2_MINOR],
    ]);
  });

  it("القمع: أُنشئ، بدأ الدفع (أو دُفع يدويًا)، دُفع، وسبب فقد ما بدأ", async () => {
    expect(await periodFunnel(db, clubId, range({ range: "today" }))).toEqual({
      created: 5,
      attempted: 4,
      paid: 2,
      failed: 1,
      expired: 1,
    });
  });

  it("لفترة ماضية: القمع كما كان عند نهايتها لا كما صار بعدها", async () => {
    // أمس حتى الآن بالطول نفسه: طلبا الصباح فقط، وطلب 10:00 خارج المدى
    const { previous } = range({ range: "today" });
    expect(await periodFunnel(db, clubId, previous)).toEqual({
      created: 1,
      attempted: 1,
      paid: 1,
      failed: 0,
      expired: 0,
    });
    // نافذة تنتهي قبل محاولة الطلب الفاشل (06:00) وقبل دفع طلب 21:00: لا بدء دفع ولا دفع ولا فقد بعده
    const early = {
      start: new Date("2026-11-25T21:00:00Z"),
      end: new Date("2026-11-25T21:05:00Z"),
    };
    expect(await periodFunnel(db, clubId, early)).toEqual({
      created: 1,
      attempted: 0,
      paid: 0,
      failed: 0,
      expired: 0,
    });
    // تنتهي بعد محاولة طلب 07:00 المنقضية وقبل مهلته (08:00): بدأ ولم يُفقد بعد
    const midway = {
      start: new Date("2026-11-26T07:00:00Z"),
      end: new Date("2026-11-26T07:45:00Z"),
    };
    expect(await periodFunnel(db, clubId, midway)).toEqual({
      created: 1,
      attempted: 1,
      paid: 0,
      failed: 0,
      expired: 0,
    });
  });

  it("نادٍ بلا طلبات: قمع صفري، ولا طلب له", async () => {
    const empty = await createTestClub(db);
    expect(await periodFunnel(db, empty, range({ range: "30d" }))).toMatchObject({ created: 0 });
    expect(await clubHasOrders(db, empty)).toBe(false);
    expect(await clubHasOrders(db, clubId)).toBe(true);
  });
});

describe("الأداء: الاستعلامات على فهرسي النادي", () => {
  /** خطة استعلام عدّ لنادٍ في فترة على عمود زمني، والمسح المتسلسل مطفأ (قاعدة الاختبار صغيرة). */
  async function plan(column: "paid_at" | "created_at"): Promise<string> {
    const { start, end } = range({ range: "30d" });
    const [, , rows] = await db.$transaction([
      db.$executeRawUnsafe("ANALYZE orders"),
      db.$executeRawUnsafe("SET LOCAL enable_seqscan = off"),
      db.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN SELECT count(*) FROM orders WHERE club_id = '${clubId}'::uuid
          AND ${column} >= '${start.toISOString()}'::timestamptz
          AND ${column} < '${end.toISOString()}'::timestamptz`,
      ),
    ]);
    return rows.map((row) => row["QUERY PLAN"]).join("\n");
  }

  it("الدفع في فترة مدى على (club_id, paid_at)، والإنشاء على (club_id, created_at)", async () => {
    const paid = await plan("paid_at");
    expect(paid).toContain("orders_club_id_paid_at_idx");
    expect(paid).toMatch(/Index Cond: \(\(club_id = .*\) AND \(paid_at >= /);
    const created = await plan("created_at");
    expect(created).toContain("orders_club_id_created_at_idx");
    expect(created).toMatch(/Index Cond: \(\(club_id = .*\) AND \(created_at >= /);
  });
});
