import { randomUUID } from "node:crypto";
import type { PromotionDraftInput, PromotionStatusAction } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createOrder,
  createPromotion,
  getPromotionDetail,
  quoteCart,
  setPromotionStatus,
  staffActor,
  type Db,
  type PromotionAdminRow,
} from "./index";
import { promotionDraft } from "./test-support/catalog-admin-fixtures";
import {
  createPlan,
  createTestClub,
  TEST_NOW,
  type TestProduct,
} from "./test-support/commerce-fixtures";
import {
  couponCode,
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
const TEN_OFF = 81_000;
const MINUTE_MS = 60_000;
const LATER = new Date(TEST_NOW.getTime() + MINUTE_MS);

let db: Db;
let other: Db;
let clubId: string;
let otherClubId: string;
let plan: TestProduct;
let actor: ReturnType<typeof staffActor>;
let phoneIndex = 500;
let codeIndex = 0;

function nextCode(): string {
  codeIndex += 1;
  return `ADM${String(codeIndex).padStart(4, "0")}`;
}

function nextBuyer() {
  phoneIndex += 1;
  return testBuyer(testPhone(phoneIndex));
}

async function detailOf(promotionId: string, now = LATER): Promise<PromotionAdminRow> {
  const detail = await getPromotionDetail(db, clubId, promotionId, now);
  if (detail === undefined) {
    throw new Error("العرض غير موجود");
  }
  return detail;
}

async function newPromotion(change: Partial<PromotionDraftInput> = {}): Promise<PromotionAdminRow> {
  const promotionId = randomUUID();
  const draft = promotionDraft({ code: nextCode(), ...change });
  unwrap(await createPromotion(db, { promotionId, clubId, draft, actor, now: TEST_NOW }));
  return detailOf(promotionId);
}

function setStatus(promotion: PromotionAdminRow, action: PromotionStatusAction, now = LATER) {
  return setPromotionStatus(db, {
    promotionId: promotion.rule.id,
    clubId,
    lockToken: promotion.lockToken,
    action,
    actor,
    now,
  });
}

async function activated(change: Partial<PromotionDraftInput> = {}): Promise<PromotionAdminRow> {
  const promotion = await newPromotion(change);
  unwrap(await setStatus(promotion, "activate"));
  return detailOf(promotion.rule.id);
}

function orderWith(promotion: PromotionAdminRow, total = TEN_OFF, now = LATER) {
  const code = promotion.rule.code;
  return createOrder(
    db,
    orderInput(plan.slug, total, { couponCode: code, buyer: nextBuyer(), now }),
  );
}

beforeAll(async () => {
  db = createDb(testDatabaseUrl());
  [other] = createDbClients(1) as [Db];
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
  otherClubId = await createTestClub(db);
  plan = await createPlan(db, clubId, { priceMinor: PRICE, durationMonths: 1 });
  actor = staffActor((await createTestStaff(db, clubId, { role: "manager" })).id);
});

beforeEach(async () => {
  await db.$executeRaw`
    TRUNCATE audit_logs, memberships, order_discounts, order_items, orders, customers,
      promotions CASCADE`;
});

afterAll(async () => {
  await resetCommerceTables(db);
  await disconnectAll([db, other]);
});

describe("setPromotionStatus", () => {
  it("الإيقاف المؤقت يسري على أول طلب تالٍ، والطلب المعلّق يبقى بلقطته، ثم يُفعَّل من جديد", async () => {
    const promotion = await activated();
    const pending = unwrap(await orderWith(promotion));
    unwrap(await setStatus(await detailOf(promotion.rule.id), "pause"));
    const request = { planSlug: plan.slug, addonSlugs: [], couponCode: promotion.rule.code };
    const quote = unwrap(await quoteCart(db, request, LATER));
    expect(quote.couponError).toMatchObject({ reason: "promotion.inactive" });
    expect(quote.total.amountMinor).toBe(PRICE);
    expect(failure(await orderWith(promotion)).reason).toBe("promotion.inactive");
    expect(await db.order.findUniqueOrThrow({ where: { id: pending.orderId } })).toMatchObject({
      status: "pending_payment",
      totalMinor: TEN_OFF,
    });
    unwrap(await setStatus(await detailOf(promotion.rule.id), "activate"));
    expect(unwrap(await quoteCart(db, request, LATER)).total.amountMinor).toBe(TEN_OFF);
    const actions = await db.auditLog.findMany({
      where: { entityId: promotion.rule.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(actions.map((row) => [row.action, row.fromState, row.toState])).toEqual([
      ["promotion_created", null, "draft"],
      ["promotion_activated", "draft", "active"],
      ["promotion_paused", "active", "paused"],
      ["promotion_activated", "paused", "active"],
    ]);
  });

  it("عرض تلقائي متوقف لا يدخل التسعير (loadCandidateIds)", async () => {
    const automatic = await activated({ type: "automatic" });
    const request = { planSlug: plan.slug, addonSlugs: [], couponCode: null };
    expect(unwrap(await quoteCart(db, request, LATER)).total.amountMinor).toBe(TEN_OFF);
    unwrap(await setStatus(automatic, "pause"));
    expect(unwrap(await quoteCart(db, request, LATER)).total.amountMinor).toBe(PRICE);
    unwrap(await createOrder(db, orderInput(plan.slug, PRICE, { buyer: nextBuyer(), now: LATER })));
    expect(await db.orderDiscount.count()).toBe(0);
  });

  it("الإنهاء نهائي: يقفل النافذة عند الآن إن كان سارٍ، والرمز يبقى محجوزًا", async () => {
    const running = await activated();
    unwrap(await setStatus(running, "end"));
    const ended = await detailOf(running.rule.id);
    expect(ended).toMatchObject({ state: "archived", rule: { status: "archived", endsAt: LATER } });
    expect(failure(await setStatus(ended, "activate")).reason).toBe("promotion.archived_final");
    expect(unwrap(await setStatus(ended, "end"))).toEqual({ status: "archived", replayed: true });
    expect(
      await db.auditLog.count({ where: { entityId: running.rule.id, action: "promotion_ended" } }),
    ).toBe(1);
    const future = await activated({ startsAt: "2027-01-01T00:00" });
    unwrap(await setStatus(future, "end"));
    expect((await detailOf(future.rule.id)).rule.endsAt).toBeNull();
    expect(failure(await orderWith(running)).reason).toBe("promotion.inactive");
  });

  it("رمز قفل قديم مرفوض، والمسودة لا تُوقف", async () => {
    const promotion = await newPromotion();
    expect(failure(await setStatus(promotion, "pause")).reason).toBe(
      "promotion.status_not_allowed",
    );
    unwrap(await setStatus(promotion, "activate"));
    expect(failure(await setStatus(promotion, "pause")).reason).toBe("promotion.stale_edit");
  });
});

describe("P2 بـSQL خام", () => {
  it("الرمز والنادي ووقت الإنشاء ثابتة بعد الإنشاء، وغيرها يتغير", async () => {
    const promotion = await newPromotion();
    const id = promotion.rule.id;
    const attempts = [
      db.$executeRaw`UPDATE promotions SET code = 'CHANGED1' WHERE id = ${id}::uuid`,
      db.$executeRaw`UPDATE promotions SET code = NULL WHERE id = ${id}::uuid`,
      db.$executeRaw`UPDATE promotions SET club_id = ${otherClubId}::uuid WHERE id = ${id}::uuid`,
      db.$executeRaw`UPDATE promotions SET created_at = now() WHERE id = ${id}::uuid`,
    ];
    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrow("promotion_identity_immutable");
    }
    await db.$executeRaw`UPDATE promotions SET status = 'paused' WHERE id = ${id}::uuid`;
    expect((await detailOf(id)).state).toBe("paused");
    expect(couponCode(promotion.rule.code ?? "")).toBe(promotion.rule.code);
  });
});
