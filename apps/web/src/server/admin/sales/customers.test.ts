import { DomainError, err, ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "../session";

/** بحث الجوال وكشفه بقاعدة مستبدلة: الحدود، والرسالة الواحدة، وأن الرقم لا يدخل سجلًا. */
const STAFF = { id: "018f4e2a-0000-7000-8000-000000000001", clubId: "club-1", role: "sales" };
const CUSTOMER_ID = "018f4e2a-0000-7000-8000-0000000000c1";
const PHONE = "+966512345678";

const findCustomerIdByPhone = vi.fn(
  (): Promise<string | undefined> => Promise.resolve(CUSTOMER_ID),
);
const revealCustomerPhone = vi.fn(() =>
  Promise.resolve(ok({ customerId: CUSTOMER_ID, phoneE164: PHONE })),
);
vi.mock("@masar/db", () => ({
  findCustomerIdByPhone,
  revealCustomerPhone,
  staffActor: (id: string) => `staff:${id}`,
}));
vi.mock("../../db", () => ({ getDb: () => ({}) }));
const warn = vi.fn();
vi.mock("../../logger", () => ({ logger: { warn } }));
const limits = { lookup: true, reveal: true };
const allowPhoneLookup = vi.fn(() => limits.lookup);
const allowPhoneReveal = vi.fn(() => limits.reveal);
vi.mock("../throttle", () => ({ allowPhoneLookup, allowPhoneReveal }));

const { lookupCustomer, revealPhone } = await import("./customers");

const context = { staff: STAFF } as unknown as StaffContext;
const NOW = new Date("2026-06-15T09:00:00Z");

afterEach(() => {
  vi.clearAllMocks();
  limits.lookup = true;
  limits.reveal = true;
});

describe("lookupCustomer", () => {
  it("يطبّع الرقم ويبحث بمطابقة تامة داخل نادي الموظف، ويرجع المعرّف لا الرقم", async () => {
    const found = await lookupCustomer(context, " ٠٥١٢ ٣٤٥ ٦٧٨ ");
    expect(found).toEqual({ ok: true, value: CUSTOMER_ID });
    expect(findCustomerIdByPhone).toHaveBeenCalledWith({}, "club-1", PHONE);
  });

  it("رقم بغير شكله أو جزء منه يُرفض قبل الاستعلام", async () => {
    for (const input of ["5678", "+96651234", "أحمد", "", "05123456789"]) {
      const result = await lookupCustomer(context, input);
      expect(result.ok ? "ok" : result.error.reason).toBe("customers.mobile_invalid");
    }
    expect(findCustomerIdByPhone).not.toHaveBeenCalled();
  });

  it("غير موجود: رسالة واحدة", async () => {
    findCustomerIdByPhone.mockResolvedValueOnce(undefined);
    const result = await lookupCustomer(context, PHONE);
    expect(result.ok ? "ok" : result.error.reason).toBe("customer.not_found");
  });

  it("تجاوز الحد يرفض قبل أي استعلام، ويُسجَّل بلا الرقم", async () => {
    limits.lookup = false;
    const result = await lookupCustomer(context, PHONE);
    expect(result.ok ? "ok" : result.error.reason).toBe("customers.too_many_lookups");
    expect(findCustomerIdByPhone).not.toHaveBeenCalled();
    expect(allowPhoneLookup).toHaveBeenCalledWith(STAFF.id);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("512345678");
  });
});

describe("revealPhone", () => {
  const target = { source: "customer", customerId: CUSTOMER_ID } as const;

  it("يكشف باسم الموظف وناديه", async () => {
    expect(await revealPhone(context, target, NOW)).toEqual({ ok: true, value: PHONE });
    expect(revealCustomerPhone).toHaveBeenCalledWith(
      {},
      { clubId: "club-1", target, actor: `staff:${STAFF.id}`, now: NOW },
    );
  });

  it("تجاوز الحد: لا قراءة ولا رقم، وسطر في السجل المنظَّم بلا رقم", async () => {
    limits.reveal = false;
    const result = await revealPhone(context, { source: "order", orderId: CUSTOMER_ID }, NOW);
    expect(result.ok ? "ok" : result.error.reason).toBe("customers.too_many_reveals");
    expect(revealCustomerPhone).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("admin.phone_reveal_throttled", {
      staffId: STAFF.id,
      source: "order",
    });
  });

  it("فشل القاعدة (ومنه فشل سطر التدقيق) لا يرجع رقمًا", async () => {
    revealCustomerPhone.mockResolvedValueOnce(
      err(new DomainError("not_found", "customer.not_found")) as never,
    );
    const missing = await revealPhone(context, target, NOW);
    expect(missing.ok ? "ok" : missing.error.reason).toBe("customer.not_found");
    revealCustomerPhone.mockRejectedValueOnce(new Error("audit_logs_actor_known"));
    await expect(revealPhone(context, target, NOW)).rejects.toThrow("audit_logs_actor_known");
  });
});
