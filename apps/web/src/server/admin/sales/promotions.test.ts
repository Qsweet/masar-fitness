import type { PromotionAdminRow } from "@masar/db";
import { basisPoints, DomainError, err, ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminDictionary } from "@/i18n/admin";
import type { StaffContext } from "../session";
import {
  copiedPromotionValues,
  emptyPromotionValues,
  percentInput,
  promotionFormValues,
  promotionInput,
  promotionValues,
  selectedProductIds,
} from "./promotion-form";
import {
  countByState,
  discountText,
  parsePromotionTab,
  rowsOfTab,
  usageText,
  windowText,
} from "./promotions-view";

/** كتابات العروض بقاعدة مستبدلة، وتحويل قيم النموذج، ونصوص العرض. */
const PROMOTION_ID = "018f4e2a-0000-7000-8000-0000000000d1";
const PRODUCT_A = "018f4e2a-0000-7000-8000-0000000000a1";
const PRODUCT_B = "018f4e2a-0000-7000-8000-0000000000a2";
const OWNER = { id: "018f4e2a-0000-7000-8000-000000000001", clubId: "club-1", role: "owner" };
const NOW = new Date("2026-06-15T09:00:00Z");
const ZONE = "Asia/Riyadh";

const createPromotion = vi.fn(() =>
  Promise.resolve(ok({ promotionId: PROMOTION_ID, replayed: false })),
);
const updatePromotion = vi.fn(() => Promise.resolve(ok({ exhausted: true })));
const setPromotionStatus = vi.fn(() => Promise.resolve(ok({ status: "paused", replayed: false })));
const automaticZeroedNames = vi.fn(() =>
  Promise.resolve([
    { ar: "3 أشهر", en: "3 months" },
    { ar: "شهر واحد", en: "One month" },
  ]),
);
vi.mock("@masar/db", () => ({
  AUTOMATIC_ZEROES_SALE: "promotion.automatic_zeroes_sale",
  automaticZeroedNames,
  createPromotion,
  updatePromotion,
  setPromotionStatus,
  getSalesSettings: () => Promise.resolve({ currency: "SAR", timezone: "Asia/Riyadh" }),
  staffActor: (id: string) => `staff:${id}`,
}));
vi.mock("../../db", () => ({ getDb: () => ({}) }));

const { changePromotionStatus, createPromotionDraft, savePromotion } = await import("./promotions");
const context = { staff: OWNER } as unknown as StaffContext;
const text = getAdminDictionary().sales.promotions;

const VALUES = {
  ...emptyPromotionValues(NOW, ZONE),
  code: "ramadan20",
  nameAr: "عرض رمضان",
  nameEn: "Ramadan",
  percent: "12.5",
};

function row(overrides: Partial<PromotionAdminRow["rule"]> = {}, active = 3): PromotionAdminRow {
  return {
    rule: {
      id: PROMOTION_ID,
      code: null,
      name: { ar: "عرض", en: "Offer" },
      status: "active",
      discount: { kind: "percentage", rate: basisPoints(1250) },
      audience: "anyone",
      scope: { kind: "listed_products", productIds: [PRODUCT_A, PRODUCT_B] },
      stackable: true,
      startsAt: new Date("2026-05-31T21:00:00Z"),
      endsAt: null,
      maxRedemptions: 100,
      maxRedemptionsPerCustomer: null,
      ...overrides,
    },
    products: [],
    usage: { total: active, active, paidOrders: 1, discountGranted: { amountMinor: 0 } as never },
    state: "running",
    createdAt: NOW,
    lockToken: "1",
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("قيم نموذج العرض", () => {
  it("عرض جديد: يبدأ الآن بتوقيت النادي، وبلا قيمة مقترحة للخصم ولا للحدود", () => {
    expect(emptyPromotionValues(NOW, ZONE)).toMatchObject({
      type: "coupon",
      startsAt: "2026-06-15T12:00",
      percent: "",
      amount: "",
      maxRedemptions: "",
      audience: "anyone",
    });
  });

  it("خانات المنتجات تُجمع في حقل واحد، والحقل الأطول من حده فارغ", () => {
    const data = new FormData();
    data.set("nameAr", "عرض");
    data.set("code", "x".repeat(65));
    data.append("productIds", PRODUCT_A);
    data.append("productIds", PRODUCT_B);
    const values = promotionValues(data);
    expect(values).toMatchObject({
      nameAr: "عرض",
      code: "",
      productIds: `${PRODUCT_A},${PRODUCT_B}`,
    });
    expect(selectedProductIds(values)).toEqual([PRODUCT_A, PRODUCT_B]);
    expect(promotionInput({ ...values, stackable: "on" })).toMatchObject({
      productIds: [PRODUCT_A, PRODUCT_B],
      stackable: true,
    });
    expect(promotionInput({}).stackable).toBe(false);
  });

  it("من عرض قائم: النسبة والنافذة كما تُكتبان؛ والنسخة بلا رمز وتبدأ الآن", () => {
    const source = row({ code: "OLD10" as never, endsAt: new Date("2026-06-30T21:00:00Z") });
    expect(promotionFormValues(source, ZONE)).toMatchObject({
      type: "coupon",
      code: "OLD10",
      percent: "12.5",
      scope: "listed_products",
      productIds: `${PRODUCT_A},${PRODUCT_B}`,
      startsAt: "2026-06-01T00:00",
      endsAt: "2026-07-01T00:00",
      maxRedemptions: "100",
      stackable: "on",
    });
    expect(copiedPromotionValues(source, NOW, ZONE)).toMatchObject({
      type: "coupon",
      code: "",
      percent: "12.5",
      startsAt: "2026-06-15T12:00",
      endsAt: "",
    });
    expect([1000, 1250, 1, 10_000].map(percentInput)).toEqual(["10", "12.5", "0.01", "100"]);
  });
});

describe("نصوص العروض", () => {
  it("الخصم والنافذة والاستخدام", () => {
    expect(discountText({ kind: "percentage", rate: basisPoints(1000) })).toBe("10%");
    expect(usageText(row(), text)).toBe("3 من 100");
    expect(usageText(row({ maxRedemptions: null }), text)).toBe("3، بلا حد");
    expect(windowText(row().rule, ZONE, text)).toContain("بلا نهاية");
    expect(windowText(row({ endsAt: NOW }).rule, ZONE, text)).toContain("إلى");
  });

  it("التبويبات: الكل، أو حالة معروضة واحدة؛ والمجهول الكل", () => {
    const rows = [row(), { ...row(), state: "paused" as const }];
    expect(parsePromotionTab("paused")).toBe("paused");
    expect(parsePromotionTab("bogus")).toBe("all");
    expect(parsePromotionTab(["paused"])).toBe("all");
    expect(rowsOfTab(rows, "all")).toHaveLength(2);
    expect(rowsOfTab(rows, "paused")).toHaveLength(1);
    expect(countByState(rows)).toMatchObject({ running: 1, paused: 1, draft: 0 });
  });
});

describe("createPromotionDraft و savePromotion", () => {
  it("كوبون صالح يُكتب باسم الموظف: الرمز منظَّف والنسبة نقاط أساس", async () => {
    expect(await createPromotionDraft(context, PROMOTION_ID, VALUES, NOW)).toEqual({
      ok: true,
      value: PROMOTION_ID,
    });
    const [, input] = createPromotion.mock.calls[0] as unknown as [unknown, { draft: unknown }];
    expect(input).toMatchObject({ clubId: "club-1", actor: `staff:${OWNER.id}` });
    expect(input.draft).toMatchObject({ code: "RAMADAN20", discount: { rate: 1250 } });
  });

  it.each(["new_customer", "existing_customer"])(
    "الجمهور المقيَّد «%s» مرفوض قبل أي كتابة",
    async (audience) => {
      const refused = await createPromotionDraft(
        context,
        PROMOTION_ID,
        { ...VALUES, audience },
        NOW,
      );
      expect(refused).toEqual({
        ok: false,
        error: { error: null, fields: { audience: "promotion.audience_restricted" } },
      });
      expect(createPromotion).not.toHaveBeenCalled();
    },
  );

  it("أخطاء الحقول، والرمز المستعمل على حقله", async () => {
    const invalid = await createPromotionDraft(
      context,
      PROMOTION_ID,
      { ...VALUES, percent: "150" },
      NOW,
    );
    expect(invalid).toMatchObject({
      ok: false,
      error: { fields: { percent: "promotion.percent_invalid" } },
    });
    createPromotion.mockResolvedValueOnce(
      err(new DomainError("conflict", "promotion.code_taken", { field: "code" })) as never,
    );
    expect(await createPromotionDraft(context, PROMOTION_ID, VALUES, NOW)).toEqual({
      ok: false,
      error: { error: null, fields: { code: "promotion.code_taken" } },
    });
  });

  it("التعديل يمرّر رمز القفل ويبلّغ بالاستنفاد", async () => {
    const edit = { promotionId: PROMOTION_ID, lockToken: "42", values: VALUES };
    expect(await savePromotion(context, edit, NOW)).toEqual({
      ok: true,
      value: { exhausted: true },
    });
    expect(updatePromotion).toHaveBeenCalledWith({}, expect.objectContaining({ lockToken: "42" }));
  });

  it("العرض التلقائي الذي يصفّر منتجًا: الرفض بجانب حقل الخصم ويسمّي المنتجات، والتفعيل بنصه", async () => {
    const zeroes = new DomainError("conflict", "promotion.automatic_zeroes_sale", {
      field: "amount",
    });
    createPromotion.mockResolvedValueOnce(err(zeroes) as never);
    const refused = await createPromotionDraft(context, PROMOTION_ID, VALUES, NOW);
    expect(refused).toEqual({
      ok: false,
      error: {
        error: null,
        fields: { amount: "promotion.automatic_zeroes_sale" },
        detail: "3 أشهر»، «شهر واحد",
      },
    });
    setPromotionStatus.mockResolvedValueOnce(
      err(new DomainError("conflict", "promotion.automatic_zeroes_sale")) as never,
    );
    const change = { promotionId: PROMOTION_ID, lockToken: "42", action: "activate" };
    expect(await changePromotionStatus(context, change, NOW)).toEqual({
      ok: false,
      error: { error: "promotion.automatic_zeroes_sale_now", fields: {} },
    });
  });

  it("إجراء حالة مجهول يُرفض قبل أي قراءة", async () => {
    const change = { promotionId: PROMOTION_ID, lockToken: "42", action: "delete" };
    expect(await changePromotionStatus(context, change, NOW)).toEqual({
      ok: false,
      error: { error: "sales.invalid_request", fields: {} },
    });
    expect(setPromotionStatus).not.toHaveBeenCalled();
    expect((await changePromotionStatus(context, { ...change, action: "pause" }, NOW)).ok).toBe(
      true,
    );
  });
});
