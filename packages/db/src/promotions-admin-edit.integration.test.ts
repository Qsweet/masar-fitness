import { randomUUID } from "node:crypto";
import type { PromotionDraftInput, PromotionStatusAction } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cancelPendingOrder,
  createDb,
  createOrder,
  createPromotion,
  getPromotionDetail,
  setPromotionStatus,
  staffActor,
  updatePromotion,
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

const PRICE = 90_000;
const TEN_OFF = 81_000;
const MINUTE_MS = 60_000;
const RACE_ROUNDS = 8;
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

function update(promotion: PromotionAdminRow, change: Partial<PromotionDraftInput>, client = db) {
  const draft = promotionDraft({ code: promotion.rule.code ?? "", ...change });
  return updatePromotion(client, {
    promotionId: promotion.rule.id,
    clubId,
    lockToken: promotion.lockToken,
    draft,
    actor,
    now: LATER,
  });
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

describe("updatePromotion", () => {
  it("قبل أول استخدام: كل شيء يُعدَّل عدا الرمز، بسطر تدقيق", async () => {
    const promotion = await newPromotion();
    const updated = await update(promotion, {
      nameAr: "اسم معدَّل",
      discountKind: "fixed_amount",
      amount: "50",
      scope: "listed_products",
      productIds: [plan.productId],
      maxRedemptions: "3",
      stackable: true,
    });
    expect(unwrap(updated)).toEqual({ exhausted: false });
    const after = await detailOf(promotion.rule.id);
    expect(after.rule).toMatchObject({
      name: { ar: "اسم معدَّل" },
      discount: { kind: "fixed_amount", amount: { amountMinor: 5_000 } },
      scope: { kind: "listed_products", productIds: [plan.productId] },
      maxRedemptions: 3,
      stackable: true,
    });
    expect(after.lockToken).not.toBe(promotion.lockToken);
    const audit = await db.auditLog.findFirst({
      where: { entityId: promotion.rule.id, action: "promotion_updated" },
    });
    expect(audit?.data).toMatchObject({ amountMinor: 5_000, termsFrozen: false });
    const changed = failure(
      await update(after, { code: "OTHER1", discountKind: "fixed_amount", amount: "50" }),
    );
    expect(changed.reason).toBe("promotion.code_immutable");
  });

  it("بعد أول استخدام: الشروط مجمَّدة ولو أُلغي الطلب، والباقي يُعدَّل", async () => {
    const promotion = await activated();
    const order = unwrap(await orderWith(promotion));
    unwrap(
      await cancelPendingOrder(db, {
        orderId: order.orderId,
        clubId,
        reasonCode: "other",
        actor,
        now: LATER,
      }),
    );
    const used = await detailOf(promotion.rule.id);
    expect(used.usage).toMatchObject({ total: 1, active: 0 });
    for (const change of [
      { percent: "20" },
      { discountKind: "fixed_amount", amount: "10" },
      { scope: "listed_products", productIds: [plan.productId] },
      { startsAt: "2026-02-01T00:00" },
    ]) {
      expect(failure(await update(used, change)).reason).toBe("promotion.terms_frozen");
    }
    const allowed = await update(used, {
      nameEn: "Renamed",
      endsAt: "2027-01-01T00:00",
      maxRedemptions: "9",
      maxPerCustomer: "2",
      stackable: true,
    });
    expect(allowed.ok).toBe(true);
    const snapshot = await db.orderDiscount.findFirstOrThrow({ where: { orderId: order.orderId } });
    expect(snapshot.amountMinor).toBe(PRICE - TEN_OFF);
  });

  it("خفض الحد دون الاستخدام النشط مسموح ويُبلَّغ: العرض يصير مستنفدًا", async () => {
    const promotion = await activated({ maxRedemptions: "5" });
    unwrap(await orderWith(promotion));
    unwrap(await orderWith(promotion));
    const lowered = unwrap(
      await update(await detailOf(promotion.rule.id), { maxRedemptions: "1" }),
    );
    expect(lowered).toEqual({ exhausted: true });
    expect((await detailOf(promotion.rule.id)).state).toBe("exhausted");
    expect(failure(await orderWith(promotion)).reason).toBe("promotion.exhausted");
  });

  it("رمز قفل قديم مرفوض، والمؤرشف لا يُعدَّل، وعرض نادٍ آخر غير موجود", async () => {
    const promotion = await newPromotion();
    unwrap(await update(promotion, { nameAr: "الأول" }));
    expect(failure(await update(promotion, { nameAr: "الثاني" })).reason).toBe(
      "promotion.stale_edit",
    );
    expect((await detailOf(promotion.rule.id)).rule.name.ar).toBe("الأول");
    const fresh = await detailOf(promotion.rule.id);
    unwrap(await setStatus(fresh, "end"));
    const archived = await detailOf(promotion.rule.id);
    expect(failure(await update(archived, { nameAr: "بعد الأرشفة" })).reason).toBe(
      "promotion.archived_final",
    );
    const foreign = await updatePromotion(db, {
      promotionId: promotion.rule.id,
      clubId: otherClubId,
      lockToken: archived.lockToken,
      draft: promotionDraft({ code: promotion.rule.code ?? "" }),
      actor,
      now: LATER,
    });
    expect(failure(foreign)).toMatchObject({ code: "not_found", reason: "promotion.not_found" });
  });

  it("تعديلان متزامنان بالرمز نفسه: واحد ينجح والآخر يُرفض", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const promotion = await newPromotion();
      const results = await Promise.all([
        update(promotion, { nameAr: "موظف أول" }),
        update(promotion, { nameAr: "موظف ثانٍ" }, other),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(refusalReasons(results)).toEqual(["promotion.stale_edit"]);
    }
  });

  it("خفض الحد مع طلب متزامن: يتسلسلان على قفل العرض ولا يتجاوز الاستخدام الحد", async () => {
    for (let round = 0; round < RACE_ROUNDS; round += 1) {
      const promotion = await activated({ maxRedemptions: "2" });
      unwrap(await orderWith(promotion));
      const code = promotion.rule.code;
      const [lowered, ordered] = await Promise.all([
        update(promotion, { maxRedemptions: "1" }),
        createOrder(
          other,
          orderInput(plan.slug, TEN_OFF, { couponCode: code, buyer: nextBuyer(), now: LATER }),
        ),
      ]);
      expect(lowered.ok).toBe(true);
      const after = await detailOf(promotion.rule.id);
      // الطلب سبق التعديل (فالاستخدام 2 والعرض مستنفد)، أو لحقه فرُفض بالحد الجديد
      expect(after.usage.active).toBe(ordered.ok ? 2 : 1);
      if (!ordered.ok) {
        expect(ordered.error.reason).toBe("promotion.exhausted");
      }
      expect(after.state).toBe("exhausted");
    }
  });
});
