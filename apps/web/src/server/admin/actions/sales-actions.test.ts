import { DomainError, err, ok, plainDate } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettleFormState, SettleValues } from "../sales/form-state";

/**
 * إجراءات المبيعات عند حدّها: شكل المدخل، وما يُحوَّل إليه، وأن الجوال لا يدخل رابطًا. الخدمات مستبدلة
 * (مختبرة في ملفاتها)، والحارس الحقيقي مختبر في `guard.test.ts` وتغطيته في `guard-coverage.test.ts`.
 */
const REDIRECT = "NEXT_REDIRECT";
const ORDER_ID = "018f4e2a-0000-7000-8000-000000000002";
const CUSTOMER_ID = "018f4e2a-0000-7000-8000-0000000000c1";
const STAFF = { id: "018f4e2a-0000-7000-8000-000000000001", clubId: "club-1", role: "owner" };

const redirect = vi.fn((path: string) => {
  throw new Error(`${REDIRECT} ${path}`);
});
vi.mock("next/navigation", () => ({ redirect }));
const requireStaff = vi.fn(() => Promise.resolve({ staff: STAFF }));
vi.mock("../guard", () => ({ requireStaff }));
const cancelPendingOrder = vi.fn(() => Promise.resolve(ok({ orderId: ORDER_ID })));
vi.mock("@masar/db", () => ({
  cancelPendingOrder,
  staffActor: (id: string) => `staff:${id}`,
}));
vi.mock("../../db", () => ({ getDb: () => ({}) }));
const lookupCustomer = vi.fn((): Promise<unknown> => Promise.resolve(ok(CUSTOMER_ID)));
const revealPhone = vi.fn((): Promise<unknown> => Promise.resolve(ok("+966512345678")));
vi.mock("../sales/customers", () => ({ lookupCustomer, revealPhone }));
const PAYLOAD = {
  paymentId: "018f4e2a-7b1c-7d3e-9f4a-5b6c7d8e9f01",
  details: {
    method: "bank_transfer",
    externalReference: "TRF-88412",
    receivedOn: plainDate(2026, 6, 15),
    note: null,
  },
  amountMinor: 149_900,
  currency: "SAR",
};
const prepareManualSettlement = vi.fn(
  (): Promise<unknown> => Promise.resolve(ok({ token: "sealed-token", payload: PAYLOAD })),
);
const confirmManualSettlement = vi.fn((): Promise<unknown> => Promise.resolve(ok({})));
vi.mock("../sales/settle", () => ({ prepareManualSettlement, confirmManualSettlement }));

const { cancelOrderAction } = await import("./sales-cancel");
const { settleOrderAction } = await import("./sales-settle");
const { lookupCustomerAction, revealPhoneAction } = await import("./sales-customers");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const EMPTY = { error: null };
const VALUES: SettleValues = {
  method: "bank_transfer",
  externalReference: "TRF-88412",
  receivedOn: "2026-06-15",
  amount: "1499",
  note: "",
};
const EDIT: SettleFormState = { step: "edit", error: null, values: VALUES };

afterEach(() => {
  vi.clearAllMocks();
});

describe("cancelOrderAction", () => {
  it("سبب من القائمة: يلغي باسم الموظف ويحوّل إلى الطلب بتنبيه", async () => {
    const data = form({ orderId: ORDER_ID, reason: "duplicate_order" });
    await expect(cancelOrderAction(EMPTY, data)).rejects.toThrow(
      `${REDIRECT} /admin/sales/orders/${ORDER_ID}?done=order_cancelled`,
    );
    expect(requireStaff).toHaveBeenCalledWith("orders.cancel");
    expect(cancelPendingOrder).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        orderId: ORDER_ID,
        clubId: "club-1",
        reasonCode: "duplicate_order",
        actor: `staff:${STAFF.id}`,
      }),
    );
  });

  it.each(["", "refund", "OTHER", "x".repeat(33), "customer_request; DROP"])(
    "سبب خارج القائمة «%s» يُرفض قبل القاعدة",
    async (reason) => {
      const state = await cancelOrderAction(EMPTY, form({ orderId: ORDER_ID, reason }));
      expect(state.error).toBe("order.cancel_reason_invalid");
      expect(cancelPendingOrder).not.toHaveBeenCalled();
    },
  );

  it("معرّف ليس UUID: طلب غير صالح", async () => {
    const state = await cancelOrderAction(EMPTY, form({ orderId: "1 OR 1=1", reason: "other" }));
    expect(state.error).toBe("sales.invalid_request");
    expect(cancelPendingOrder).not.toHaveBeenCalled();
  });

  it("رفض القاعدة يرجع سببه للنموذج", async () => {
    cancelPendingOrder.mockResolvedValueOnce(
      err(new DomainError("conflict", "order.not_cancellable")) as never,
    );
    const state = await cancelOrderAction(EMPTY, form({ orderId: ORDER_ID, reason: "other" }));
    expect(state.error).toBe("order.not_cancellable");
  });
});

describe("lookupCustomerAction", () => {
  it("يحوّل إلى صفحة العميل بمعرّفه: الجوال ليس في الرابط", async () => {
    const outcome = lookupCustomerAction(EMPTY, form({ mobile: "0512345678" }));
    await expect(outcome).rejects.toThrow(`${REDIRECT} /admin/sales/customers/${CUSTOMER_ID}`);
    const [path] = redirect.mock.calls[0] ?? [""];
    expect(path).not.toMatch(/512345678|mobile|phone/);
    expect(requireStaff).toHaveBeenCalledWith("customers.read");
  });

  it("غير موجود أو تجاوز الحد: سبب في النموذج بلا تحويل", async () => {
    lookupCustomer.mockResolvedValueOnce(err(new DomainError("not_found", "customer.not_found")));
    const state = await lookupCustomerAction(EMPTY, form({ mobile: "0512345678" }));
    expect(state.error).toBe("customer.not_found");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("إدخال أطول من أي جوال يصل فارغًا", async () => {
    lookupCustomer.mockResolvedValueOnce(
      err(new DomainError("validation", "customers.mobile_invalid")),
    );
    await lookupCustomerAction(EMPTY, form({ mobile: "0".repeat(33) }));
    expect(lookupCustomer).toHaveBeenCalledWith({ staff: STAFF }, "");
  });
});

describe("revealPhoneAction", () => {
  it("الرقم يرجع في حالة النموذج وحدها", async () => {
    const state = await revealPhoneAction(
      { error: null, phone: null },
      form({ source: "order", id: ORDER_ID }),
    );
    expect(state).toEqual({ error: null, phone: "+966512345678" });
    expect(requireStaff).toHaveBeenCalledWith("customers.reveal_phone");
    expect(revealPhone).toHaveBeenCalledWith(
      { staff: STAFF },
      { source: "order", orderId: ORDER_ID },
      expect.any(Date),
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    { source: "staff", id: ORDER_ID },
    { source: "order", id: "not-a-uuid" },
    { source: "", id: ORDER_ID },
  ])("هدف بغير شكله %o: مرفوض بلا قراءة", async (fields) => {
    const state = await revealPhoneAction({ error: null, phone: null }, form(fields));
    expect(state).toEqual({ error: "sales.invalid_request", phone: null });
    expect(revealPhone).not.toHaveBeenCalled();
  });

  it("الرفض لا يرجع رقمًا", async () => {
    revealPhone.mockResolvedValueOnce(
      err(new DomainError("forbidden", "customers.too_many_reveals")),
    );
    const state = await revealPhoneAction(
      { error: null, phone: null },
      form({ source: "customer", id: CUSTOMER_ID }),
    );
    expect(state).toEqual({ error: "customers.too_many_reveals", phone: null });
  });
});

describe("settleOrderAction", () => {
  const review = { ...VALUES, orderId: ORDER_ID, intent: "review" };

  it("«راجع»: حالة التأكيد بالرمز ونصوص إعادة العرض، بلا تنفيذ", async () => {
    const state = await settleOrderAction(EDIT, form(review));
    expect(state).toEqual({
      step: "confirm",
      error: null,
      values: VALUES,
      token: "sealed-token",
      summary: {
        amount: "1,499 ر.س",
        method: "حوالة بنكية",
        externalReference: "TRF-88412",
        receivedOn: "15 يونيو 2026",
        note: null,
      },
    });
    expect(requireStaff).toHaveBeenCalledWith("orders.settle");
    expect(confirmManualSettlement).not.toHaveBeenCalled();
  });

  it("«راجع» بخطأ: يبقى في الحقول بما كُتب", async () => {
    prepareManualSettlement.mockResolvedValueOnce(
      err({ reason: "payment.amount_mismatch", usedByOrder: null }),
    );
    const state = await settleOrderAction(EDIT, form({ ...review, amount: "1400" }));
    expect(state).toEqual({
      step: "edit",
      error: "payment.amount_mismatch",
      usedByOrder: null,
      values: { ...VALUES, amount: "1400" },
    });
    prepareManualSettlement.mockResolvedValueOnce(
      err({ reason: "manual_payment.reference_used", usedByOrder: "MSR-0000042" }),
    );
    const used = await settleOrderAction(EDIT, form(review));
    expect(used).toMatchObject({
      step: "edit",
      error: "manual_payment.reference_used",
      usedByOrder: "MSR-0000042",
    });
  });

  it("«أكّد»: يرسل الرمز ومربع التأكيد وحدهما، ثم يحوّل إلى الطلب", async () => {
    const confirmState: SettleFormState = {
      step: "confirm",
      error: null,
      values: VALUES,
      token: "sealed-token",
      summary: { amount: "", method: "", externalReference: "", receivedOn: "", note: null },
    };
    const data = form({
      orderId: ORDER_ID,
      intent: "confirm",
      token: "sealed-token",
      confirmed: "yes",
      // حقول يدسّها عميل معدَّل لا تصل إلى الخدمة
      amount: "1",
      externalReference: "FORGED",
    });
    await expect(settleOrderAction(confirmState, data)).rejects.toThrow(
      `${REDIRECT} /admin/sales/orders/${ORDER_ID}?done=manual_payment_recorded`,
    );
    expect(confirmManualSettlement).toHaveBeenCalledWith(
      { staff: STAFF },
      { orderId: ORDER_ID, token: "sealed-token", confirmed: true },
      expect.any(Date),
    );
    expect(prepareManualSettlement).not.toHaveBeenCalled();

    confirmManualSettlement.mockResolvedValueOnce(
      err({ reason: "order.already_paid", usedByOrder: null }),
    );
    const failed = await settleOrderAction(
      confirmState,
      form({ orderId: ORDER_ID, intent: "confirm" }),
    );
    expect(failed).toEqual({ ...confirmState, error: "order.already_paid", usedByOrder: null });
    expect(confirmManualSettlement).toHaveBeenLastCalledWith(
      { staff: STAFF },
      { orderId: ORDER_ID, token: "", confirmed: false },
      expect.any(Date),
    );
  });

  it("«عدّل»: يعود إلى الحقول بما كُتب، بلا قراءة ولا كتابة", async () => {
    const state = await settleOrderAction(EDIT, form({ orderId: ORDER_ID, intent: "edit" }));
    expect(state).toEqual(EDIT);
    expect(prepareManualSettlement).not.toHaveBeenCalled();
    expect(confirmManualSettlement).not.toHaveBeenCalled();
  });

  it("نية مجهولة أو معرّف بغير شكله: طلب غير صالح", async () => {
    for (const fields of [
      { orderId: ORDER_ID, intent: "pay" },
      { orderId: ORDER_ID },
      { orderId: "x", intent: "review" },
    ]) {
      const state = await settleOrderAction(EDIT, form(fields));
      expect(state.error).toBe("sales.invalid_request");
    }
    expect(prepareManualSettlement).not.toHaveBeenCalled();
  });
});
