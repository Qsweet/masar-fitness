import { describe, expect, it } from "vitest";
import { PROMOTION_STATUSES } from "../commerce/pricing/promotion";
import { basisPoints } from "../commerce/pricing/vat";
import { money } from "../money";
import { promotionDisplayState, type PromotionStateFacts } from "./display-state";
import { checkPromotionEdit, promotionEditPolicy, type PromotionTerms } from "./edit-policy";
import { validatePromotionDraft, type PromotionDraftInput } from "./promotion-draft";
import { PROMOTION_STATUS_ACTIONS, decidePromotionStatus, endsAtWhenEnded } from "./transitions";

const NOW = new Date("2026-06-15T09:00:00Z");
const CONTEXT = { currency: "SAR", timeZone: "Asia/Riyadh" } as const;
const PRODUCT_A = "018f0000-0000-7000-8000-00000000000a";
const PRODUCT_B = "018f0000-0000-7000-8000-00000000000b";

const INPUT: PromotionDraftInput = {
  type: "coupon",
  code: " ramadan٢٠ ",
  nameAr: "عرض رمضان",
  nameEn: "Ramadan offer",
  discountKind: "percentage",
  percent: "12.5",
  amount: "",
  scope: "all_products",
  productIds: [],
  startsAt: "2026-06-01T00:00",
  endsAt: "2026-07-01T00:00",
  maxRedemptions: "100",
  maxPerCustomer: "",
  stackable: false,
  audience: "anyone",
};

function reasons(result: { ok: boolean; error?: readonly { field: string; reason: string }[] }) {
  return Object.fromEntries((result.error ?? []).map((issue) => [issue.field, issue.reason]));
}

const draft = (change: Partial<PromotionDraftInput> = {}) =>
  validatePromotionDraft({ ...INPUT, ...change }, CONTEXT);

describe("promotionDisplayState", () => {
  const FACTS: PromotionStateFacts = {
    status: "active",
    startsAt: new Date("2026-06-01T00:00:00Z"),
    endsAt: new Date("2026-07-01T00:00:00Z"),
    maxRedemptions: 10,
    activeRedemptions: 3,
  };

  it.each(["draft", "paused", "archived"] as const)(
    "%s تُعرض كما هي مهما كانت النافذة",
    (status) => {
      expect(promotionDisplayState({ ...FACTS, status, activeRedemptions: 99 }, NOW)).toBe(status);
    },
  );

  it("فعّال داخل نافذته ودون حده: سارٍ", () => {
    expect(promotionDisplayState(FACTS, NOW)).toBe("running");
    expect(promotionDisplayState({ ...FACTS, endsAt: null, maxRedemptions: null }, NOW)).toBe(
      "running",
    );
    expect(promotionDisplayState({ ...FACTS, startsAt: NOW }, NOW)).toBe("running");
  });

  it("فعّال لم يبدأ: مجدول", () => {
    expect(promotionDisplayState({ ...FACTS, startsAt: new Date(NOW.getTime() + 1) }, NOW)).toBe(
      "scheduled",
    );
  });

  it("بلغ نهايته (غير مشمولة): منتهٍ، ولو بلغ حده أيضًا", () => {
    expect(promotionDisplayState({ ...FACTS, endsAt: NOW }, NOW)).toBe("ended");
    expect(promotionDisplayState({ ...FACTS, endsAt: NOW, activeRedemptions: 10 }, NOW)).toBe(
      "ended",
    );
  });

  it("بلغ حده الكلي: مستنفد، ولو لم يبدأ", () => {
    expect(promotionDisplayState({ ...FACTS, activeRedemptions: 10 }, NOW)).toBe("exhausted");
    expect(promotionDisplayState({ ...FACTS, activeRedemptions: 11 }, NOW)).toBe("exhausted");
  });
});

describe("validatePromotionDraft", () => {
  it("كوبون بنسبة: الرمز منظَّف، والنسبة نقاط أساس، والنافذة بتوقيت النادي", () => {
    expect(draft()).toEqual({
      ok: true,
      value: {
        code: "RAMADAN20",
        name: { ar: "عرض رمضان", en: "Ramadan offer" },
        discount: { kind: "percentage", rate: basisPoints(1250) },
        scope: { kind: "all_products" },
        startsAt: new Date("2026-05-31T21:00:00Z"),
        endsAt: new Date("2026-06-30T21:00:00Z"),
        maxRedemptions: 100,
        maxRedemptionsPerCustomer: null,
        stackable: false,
        audience: "anyone",
      },
    });
  });

  it("عرض تلقائي بلا رمز ولو كُتب، وبمبلغ ثابت بعملة النادي", () => {
    const result = draft({ type: "automatic", discountKind: "fixed_amount", amount: "50" });
    expect(result).toMatchObject({
      ok: true,
      value: { code: null, discount: { kind: "fixed_amount", amount: money(5000, "SAR") } },
    });
  });

  it.each(["", "AB", "رمز", "A".repeat(33), "SAVE-10"])("رمز الكوبون «%s» مرفوض", (code) => {
    expect(reasons(draft({ code }))).toEqual({ code: "promotion.code_invalid" });
  });

  it.each(["0", "100.01", "abc", "", "1.234", "-5"])("النسبة «%s» مرفوضة", (percent) => {
    expect(reasons(draft({ percent }))).toEqual({ percent: "promotion.percent_invalid" });
  });

  it("حدّا النسبة 0.01% و100%، وعلامة النسبة مقبولة", () => {
    expect(draft({ percent: "0.01" })).toMatchObject({
      value: { discount: { rate: basisPoints(1) } },
    });
    expect(draft({ percent: "100%" })).toMatchObject({
      value: { discount: { rate: basisPoints(10_000) } },
    });
  });

  it("المبلغ الثابت موجب وبصيغة المبالغ", () => {
    const fixed = (amount: string) => draft({ discountKind: "fixed_amount", amount });
    expect(reasons(fixed("0"))).toEqual({ amount: "promotion.amount_not_positive" });
    expect(reasons(fixed("1.999"))).toEqual({ amount: "amount.too_many_decimals" });
    expect(reasons(draft({ discountKind: "bogus" }))).toEqual({
      discountKind: "promotion.discount_kind_invalid",
    });
  });

  it("نطاق القائمة يحتاج منتجًا واحدًا على الأقل، بمعرّفات صحيحة ومرتبة بلا تكرار", () => {
    const listed = (productIds: string[]) => draft({ scope: "listed_products", productIds });
    expect(reasons(listed([]))).toEqual({ scope: "promotion.products_required" });
    expect(reasons(listed(["not-a-uuid"]))).toEqual({ scope: "promotion.products_required" });
    expect(listed([PRODUCT_B, PRODUCT_A, PRODUCT_B])).toMatchObject({
      value: { scope: { kind: "listed_products", productIds: [PRODUCT_A, PRODUCT_B] } },
    });
    expect(reasons(draft({ scope: "everything" }))).toEqual({ scope: "promotion.scope_invalid" });
  });

  it("النافذة: البداية إلزامية، والنهاية بعدها أو فارغة", () => {
    expect(reasons(draft({ startsAt: "" }))).toMatchObject({
      startsAt: "promotion.starts_at_invalid",
    });
    expect(draft({ endsAt: "" })).toMatchObject({ value: { endsAt: null } });
    expect(reasons(draft({ endsAt: "2026-06-01T00:00" }))).toEqual({
      endsAt: "promotion.window_not_ordered",
    });
    expect(reasons(draft({ endsAt: "2026-13-01T00:00" }))).toEqual({
      endsAt: "promotion.ends_at_invalid",
    });
  });

  it("الحدّان: فارغ بلا حد، وإلا عدد صحيح موجب", () => {
    expect(draft({ maxRedemptions: "", maxPerCustomer: "١" })).toMatchObject({
      value: { maxRedemptions: null, maxRedemptionsPerCustomer: 1 },
    });
    expect(reasons(draft({ maxRedemptions: "0", maxPerCustomer: "1.5" }))).toEqual({
      maxRedemptions: "promotion.limit_invalid",
      maxPerCustomer: "promotion.limit_invalid",
    });
  });

  it.each(["new_customer", "existing_customer", ""])("الجمهور المقيَّد «%s» مرفوض", (audience) => {
    expect(reasons(draft({ audience }))).toEqual({ audience: "promotion.audience_restricted" });
  });

  it("نوع مجهول واسم قصير", () => {
    expect(reasons(draft({ type: "bulk", nameEn: "x" }))).toEqual({
      type: "promotion.type_invalid",
      nameEn: "promotion.name_length",
    });
  });
});

describe("promotionEditPolicy و checkPromotionEdit", () => {
  const parsed = draft();
  if (!parsed.ok) {
    throw new Error("fixture");
  }
  const DRAFT = parsed.value;
  const CURRENT: PromotionTerms = {
    code: DRAFT.code,
    discount: DRAFT.discount,
    scope: DRAFT.scope,
    audience: "anyone",
    startsAt: DRAFT.startsAt,
  };
  const free = promotionEditPolicy({ status: "active", hasRedemptions: false });
  const frozen = promotionEditPolicy({ status: "paused", hasRedemptions: true });

  it("السياسة: قبل أول استخدام كل شيء، وبعده تُجمَّد الشروط، والمؤرشف لا يُعدَّل", () => {
    expect(free).toEqual({ editable: true, terms: true });
    expect(frozen).toEqual({ editable: true, terms: false });
    for (const hasRedemptions of [true, false]) {
      expect(promotionEditPolicy({ status: "archived", hasRedemptions })).toEqual({
        editable: false,
        terms: false,
      });
    }
  });

  it("الرمز لا يتغير أبدًا، ولو قبل أول استخدام", () => {
    const result = checkPromotionEdit({ ...CURRENT, code: "OTHER" }, DRAFT, free);
    expect(!result.ok && result.error.reason).toBe("promotion.code_immutable");
  });

  it("قبل أول استخدام: الخصم والنطاق والبداية تتغير", () => {
    const changed = { ...DRAFT, discount: { kind: "percentage", rate: basisPoints(500) } } as const;
    expect(checkPromotionEdit(CURRENT, changed, free).ok).toBe(true);
  });

  it("بعد أول استخدام: ما بقي قابلًا للتعديل يُقبل", () => {
    const changed = {
      ...DRAFT,
      name: { ar: "اسم آخر", en: "Other" },
      endsAt: null,
      maxRedemptions: 5,
      maxRedemptionsPerCustomer: 1,
      stackable: true,
    };
    expect(checkPromotionEdit(CURRENT, changed, frozen).ok).toBe(true);
  });

  it.each([
    ["قيمة الخصم", { discount: { kind: "percentage", rate: basisPoints(500) } }],
    ["شكل الخصم", { discount: { kind: "fixed_amount", amount: money(1250, "SAR") } }],
    ["نوع النطاق", { scope: { kind: "listed_products", productIds: [PRODUCT_A] } }],
    ["البداية", { startsAt: new Date(0) }],
  ] as const)("بعد أول استخدام: تغيير %s مرفوض", (_name, change) => {
    const result = checkPromotionEdit(CURRENT, { ...DRAFT, ...change }, frozen);
    expect(!result.ok && result.error.reason).toBe("promotion.terms_frozen");
  });

  it("بعد أول استخدام: قائمة المنتجات تتغير ما دام نوع النطاق نفسه", () => {
    const listed = { kind: "listed_products", productIds: [PRODUCT_A] } as const;
    const next = { ...DRAFT, scope: { ...listed, productIds: [PRODUCT_B] } };
    expect(checkPromotionEdit({ ...CURRENT, scope: listed }, next, frozen).ok).toBe(true);
  });

  it("المؤرشف مرفوض قبل أي فحص آخر", () => {
    const policy = promotionEditPolicy({ status: "archived", hasRedemptions: false });
    const result = checkPromotionEdit(CURRENT, DRAFT, policy);
    expect(!result.ok && result.error.reason).toBe("promotion.archived_final");
  });
});

describe("decidePromotionStatus", () => {
  it("الجدول كاملًا: كل حالة مع كل إجراء", () => {
    const table = PROMOTION_STATUSES.flatMap((status) =>
      PROMOTION_STATUS_ACTIONS.map((action) => {
        const decision = decidePromotionStatus(status, action);
        const outcome = decision.ok
          ? `${decision.value.to}${decision.value.replay ? " (replay)" : ""}`
          : decision.error.reason;
        return `${status} + ${action} = ${outcome}`;
      }),
    );
    expect(table).toEqual([
      "draft + activate = active",
      "draft + pause = promotion.status_not_allowed",
      "draft + end = archived",
      "active + activate = active (replay)",
      "active + pause = paused",
      "active + end = archived",
      "paused + activate = active",
      "paused + pause = paused (replay)",
      "paused + end = archived",
      "archived + activate = promotion.archived_final",
      "archived + pause = promotion.archived_final",
      "archived + end = archived (replay)",
    ]);
  });

  it("النهاية عند الإنهاء: الآن إن بدأ ولم ينتهِ، وإلا كما هي", () => {
    const before = new Date(NOW.getTime() - 1000);
    const after = new Date(NOW.getTime() + 1000);
    expect(endsAtWhenEnded({ startsAt: before, endsAt: null }, NOW)).toEqual(NOW);
    expect(endsAtWhenEnded({ startsAt: before, endsAt: after }, NOW)).toEqual(NOW);
    expect(endsAtWhenEnded({ startsAt: before, endsAt: before }, NOW)).toEqual(before);
    expect(endsAtWhenEnded({ startsAt: after, endsAt: null }, NOW)).toBeNull();
    expect(endsAtWhenEnded({ startsAt: NOW, endsAt: null }, NOW)).toBeNull();
  });
});
