import { ORDER_STATUSES } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countOrdersToday,
  createDb,
  findClubSummary,
  listAuditLogs,
  listClubs,
  type ClubSummary,
  type Db,
} from "./index";
import {
  createPlan,
  createTestClub,
  insertRawOrder,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const STAFF_ID = "018f4e2a-0000-7000-8000-000000000001";
const PAGE_SIZE = 2;

let db: Db;
let clubId: string;
let club: ClubSummary;
let plan: TestProduct;

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  const summary = await findClubSummary(db, clubId);
  if (summary === null) {
    throw new Error("نادي الاختبار لم يُنشأ");
  }
  club = summary;
  plan = await createPlan(db, clubId, { priceMinor: 10_000, durationMonths: 1 });
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function audit(action: string, actor: string, entityType: string, minute: number) {
  return db.auditLog.create({
    data: {
      clubId,
      entityType,
      entityId: STAFF_ID,
      action,
      actor,
      createdAt: new Date(Date.UTC(2026, 10, 26, 9, minute)),
    },
  });
}

describe("سجل التدقيق للوحة", () => {
  beforeAll(async () => {
    await audit("login_succeeded", `staff:${STAFF_ID}`, "staff_user", 1);
    await audit("created", "customer", "order", 2);
    await audit("payment_verified", "provider", "order", 3);
    await audit("expired", "system", "order", 4);
    await audit("logout", `staff:${STAFF_ID}`, "staff_user", 5);
  });

  it("الأحدث أولًا بصفحات، مع العدد الكلي", async () => {
    const first = await listAuditLogs(db, { clubId, page: 1, pageSize: PAGE_SIZE });
    expect(first.total).toBe(5);
    expect(first.rows.map((row) => row.action)).toEqual(["logout", "expired"]);
    const last = await listAuditLogs(db, { clubId, page: 3, pageSize: PAGE_SIZE });
    expect(last.rows.map((row) => row.action)).toEqual(["login_succeeded"]);
    const beyond = await listAuditLogs(db, { clubId, page: 4, pageSize: PAGE_SIZE });
    expect(beyond.rows).toEqual([]);
  });

  it("تصفية بنوع الكيان ونوع الفاعل", async () => {
    const staffOnly = await listAuditLogs(db, {
      clubId,
      actorKind: "staff",
      page: 1,
      pageSize: 10,
    });
    expect(staffOnly.rows.map((row) => row.action)).toEqual(["logout", "login_succeeded"]);
    const orders = await listAuditLogs(db, { clubId, entityType: "order", page: 1, pageSize: 10 });
    expect(orders.total).toBe(3);
    const both = await listAuditLogs(db, {
      clubId,
      entityType: "order",
      actorKind: "provider",
      page: 1,
      pageSize: 10,
    });
    expect(both.rows).toMatchObject([{ action: "payment_verified", actor: "provider", data: {} }]);
  });

  it("نادٍ آخر لا يرى شيئًا", async () => {
    const other = await createTestClub(db);
    expect((await listAuditLogs(db, { clubId: other, page: 1, pageSize: 10 })).total).toBe(0);
  });
});

describe("طلبات اليوم بحالاتها", () => {
  /** منتصف ليل الرياض 2026-11-26 هو 21:00 UTC من اليوم السابق. */
  const NOW = new Date("2026-11-26T12:00:00Z");

  it("تعدّ طلبات يوم النادي فقط، وكل حالة تظهر ولو بصفر", async () => {
    const at = (iso: string) => ({ createdAt: new Date(iso) });
    await insertRawOrder(db, { clubId, lines: [{ product: plan }], ...at("2026-11-25T20:59:59Z") });
    await insertRawOrder(db, { clubId, lines: [{ product: plan }], ...at("2026-11-25T21:00:00Z") });
    await insertRawOrder(db, { clubId, lines: [{ product: plan }], ...at("2026-11-26T11:00:00Z") });
    await insertRawOrder(db, { clubId, lines: [{ product: plan }], ...at("2026-11-26T12:30:00Z") });
    const counts = await countOrdersToday(db, club, NOW);
    expect(Object.keys(counts).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(counts.pending_payment).toBe(2);
    expect(counts.paid + counts.fulfilled + counts.expired + counts.cancelled).toBe(0);
  });

  it("نادٍ بلا طلبات: أصفار", async () => {
    const otherId = await createTestClub(db);
    const other = await findClubSummary(db, otherId);
    const counts = await countOrdersToday(db, other ?? club, NOW);
    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
  });

  it("قائمة الأندية تحوي نادي الاختبار بمعرّفه", async () => {
    const clubs = await listClubs(db);
    expect(clubs.some((entry) => entry.id === clubId && entry.slug.length > 0)).toBe(true);
    expect(await findClubSummary(db, STAFF_ID)).toBeNull();
  });
});
