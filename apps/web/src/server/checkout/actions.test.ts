import { DomainError, err, money, ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutFormState } from "./form-state";

const flag = { enabled: true };
const NOT_FOUND = "NEXT_NOT_FOUND";
const REDIRECT = "NEXT_REDIRECT";
vi.mock("./flag", () => ({
  requireCheckout: () => {
    if (!flag.enabled) {
      throw new Error(NOT_FOUND);
    }
  },
}));
const redirect = vi.fn((path: string) => {
  throw new Error(`${REDIRECT} ${path}`);
});
vi.mock("next/navigation", () => ({ redirect }));
const placeOrder = vi.fn();
vi.mock("./place-order", () => ({ placeOrder }));
const saveCart = vi.fn(() => Promise.resolve());
vi.mock("../cart/cookie", () => ({ saveCart }));
const limits = { ip: true, mobile: true };
const allowSubmitFromIp = vi.fn(() => limits.ip);
const allowSubmitForMobile = vi.fn(() => limits.mobile);
vi.mock("./throttle", () => ({
  allowSubmitFromIp,
  allowSubmitForMobile,
  requestIp: () => Promise.resolve("203.0.113.7"),
}));

const { submitCheckout } = await import("./actions");
const { initialCheckoutState } = await import("./form-state");

const KEY = "0b6c1a52-8f0e-4c55-9a43-2f8f8d7c1e11";
const TOKEN = "a".repeat(43);

function initial(): CheckoutFormState {
  return { ...initialCheckoutState(money(280_000), "ar"), idempotencyKey: KEY };
}

function formData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    name: "محمد",
    mobile: "055 123 4567",
    coupon: "",
    idempotencyKey: KEY,
    quotedTotalMinor: "280000",
    locale: "en",
    slug: "one-year",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  data.append("addon", "demo-addon");
  return data;
}

function rejectWith(error: DomainError): void {
  placeOrder.mockResolvedValueOnce(err(error));
}

afterEach(() => {
  flag.enabled = true;
  limits.ip = true;
  limits.mobile = true;
  placeOrder.mockReset();
  saveCart.mockClear();
  redirect.mockClear();
  allowSubmitFromIp.mockClear();
  allowSubmitForMobile.mockClear();
});

describe("submitCheckout", () => {
  it("العلم مغلق ⇒ 404 قبل أي شيء، ولا نداء لإنشاء الطلب", async () => {
    flag.enabled = false;
    await expect(submitCheckout(initial(), formData())).rejects.toThrow(NOT_FOUND);
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("النجاح ⇒ مشترٍ منظَّف وكوبون منظَّف، ثم تحويل إلى صفحة الطلب بلغة النموذج", async () => {
    placeOrder.mockResolvedValueOnce(ok({ publicToken: TOKEN }));
    await expect(submitCheckout(initial(), formData({ coupon: " demo10 " }))).rejects.toThrow(
      `${REDIRECT} /en/checkout/orders/${TOKEN}`,
    );
    expect(placeOrder).toHaveBeenCalledWith({
      slug: "one-year",
      addonSlugs: ["demo-addon"],
      couponCode: "DEMO10",
      buyer: { name: "محمد", mobile: "+966551234567" },
      locale: "en",
      idempotencyKey: KEY,
      quotedTotalMinor: 280_000,
    });
    // الطلب أُنشئ ⇒ السلة تُفرَّغ قبل التحويل
    expect(saveCart).toHaveBeenCalledWith({ slug: null });
  });

  it("اسم وجوال خاطئان ⇒ كل أخطاء الحقلين معًا، والقيم محفوظة، والمفتاح نفسه", async () => {
    const state = await submitCheckout(initial(), formData({ name: " ", mobile: "123" }));
    expect(state.errors).toEqual({
      name: "buyer.name_too_short",
      mobile: "mobile.not_saudi_mobile",
    });
    expect(state.values).toEqual({ name: " ", mobile: "123" });
    expect(state.idempotencyKey).toBe(KEY);
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("كوبون بصيغة خاطئة ⇒ الخطأ على حقل الكوبون بلا طلب", async () => {
    const state = await submitCheckout(initial(), formData({ coupon: "!!" }));
    expect(state.errors).toEqual({ coupon: "coupon.invalid_format" });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("حقل مخفي عُبث به ⇒ خطأ عام على النموذج بلا طلب", async () => {
    const state = await submitCheckout(initial(), formData({ idempotencyKey: "x" }));
    expect(state.errors).toEqual({ form: "form.invalid" });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("تغيّر السعر ⇒ الإجمالي الجديد منسَّقًا ومفتاح جديد وتنبيه، بلا خطأ", async () => {
    rejectWith(
      new DomainError("conflict", "cart.price_changed", { cause: { totalMinor: 252_000 } }),
    );
    const state = await submitCheckout(initial(), formData());
    expect(state).toMatchObject({
      errors: {},
      quotedTotalMinor: 252_000,
      total: { amount: "2,520", unit: "SAR" },
      notice: "price_changed",
    });
    expect(state.idempotencyKey).not.toBe(KEY);
    expect(state.values.name).toBe("محمد");
  });

  it("المفتاح مستعمل ببيانات أخرى ⇒ مفتاح جديد وتنبيه «تغيّرت البيانات»", async () => {
    rejectWith(new DomainError("conflict", "order.idempotency_key_reused"));
    const state = await submitCheckout(initial(), formData());
    expect(state.notice).toBe("data_changed");
    expect(state.errors).toEqual({});
    expect(state.idempotencyKey).not.toBe(KEY);
  });

  it("كل سبب رفض آخر يذهب إلى حقله، والمفتاح يبقى", async () => {
    const cases: [DomainError, CheckoutFormState["errors"]][] = [
      [
        new DomainError("validation", "promotion.exhausted", { field: "coupon" }),
        { coupon: "promotion.exhausted" },
      ],
      [
        new DomainError("validation", "promotion.customer_limit_reached", { field: "coupon" }),
        { coupon: "promotion.customer_limit_reached" },
      ],
      [new DomainError("conflict", "order.too_many_pending"), { form: "order.too_many_pending" }],
      [
        new DomainError("not_found", "cart.product_unavailable"),
        { form: "cart.product_unavailable" },
      ],
      [
        new DomainError("conflict", "policy.undecided.order_payment_window"),
        { form: "policy.undecided.order_payment_window" },
      ],
    ];
    for (const [error, errors] of cases) {
      rejectWith(error);
      const state = await submitCheckout(initial(), formData());
      expect(state.errors, error.reason).toEqual(errors);
      expect(state.idempotencyKey).toBe(KEY);
      expect(state.notice).toBeNull();
    }
  });

  it("أسباب وجود الرمز (غير موجود، غير مفعّل، لم يبدأ) تُطوى في نص الكوبون العام", async () => {
    for (const reason of ["coupon.unknown", "promotion.inactive", "promotion.not_started"]) {
      rejectWith(new DomainError("validation", reason, { field: "coupon" }));
      const state = await submitCheckout(initial(), formData({ coupon: "SECRET1" }));
      expect(state.errors, reason).toEqual({ coupon: "coupon.rejected" });
    }
  });
});

describe("submitCheckout: حدود المحاولات", () => {
  it("تجاوز حد العنوان ⇒ خطأ على النموذج قبل قراءته، بلا طلب ولا فحص جوال", async () => {
    limits.ip = false;
    const state = await submitCheckout(initial(), formData());
    expect(state.errors).toEqual({ form: "checkout.throttled" });
    expect(state.values.name).toBe("محمد");
    expect(allowSubmitFromIp).toHaveBeenCalledWith("203.0.113.7");
    expect(allowSubmitForMobile).not.toHaveBeenCalled();
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("تجاوز حد الجوال ⇒ الجوال بصيغته الموحّدة هو المفتاح، بلا طلب", async () => {
    limits.mobile = false;
    const state = await submitCheckout(initial(), formData());
    expect(state.errors).toEqual({ form: "checkout.throttled" });
    expect(state.idempotencyKey).toBe(KEY);
    expect(allowSubmitForMobile).toHaveBeenCalledWith("+966551234567");
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("جوال غير صالح لا يستهلك حد الجوال", async () => {
    await submitCheckout(initial(), formData({ mobile: "123" }));
    expect(allowSubmitFromIp).toHaveBeenCalledTimes(1);
    expect(allowSubmitForMobile).not.toHaveBeenCalled();
  });
});
