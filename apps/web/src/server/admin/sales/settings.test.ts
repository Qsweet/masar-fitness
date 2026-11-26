import { ok } from "@masar/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "../session";

/** إعدادات البيع بقاعدة وبيئة مستبدلتين: المراجعة قبل الكتابة، وبلا افتراضي، وأدنى مهلة المزوّد. */
const OWNER = { id: "018f4e2a-0000-7000-8000-000000000001", clubId: "club-1", role: "owner" };
const NOW = new Date("2026-06-15T09:00:00Z");

const current = {
  orderPaymentWindowMinutes: null as number | null,
  membershipStartRule: null as string | null,
};
const payments = { mode: "off", minPaymentMinutes: 10 };
const updateSalesSettings = vi.fn(() => Promise.resolve(ok({ changed: true })));
vi.mock("@masar/db", () => ({
  getSalesSettings: () => Promise.resolve({ ...current, lockToken: "7" }),
  updateSalesSettings,
  staffActor: (id: string) => `staff:${id}`,
}));
vi.mock("../../db", () => ({ getDb: () => ({}) }));
vi.mock("../../env", () => ({ getEnv: () => ({ PAYMENTS: payments }) }));

const { providerMinimumWindow, saveSalesSettings } = await import("./settings");
const context = { staff: OWNER } as unknown as StaffContext;

function save(values: Record<string, string>, intent: "save" | "confirm" = "save") {
  return saveSalesSettings(context, { lockToken: "7", values, intent }, NOW);
}

afterEach(() => {
  vi.clearAllMocks();
  current.orderPaymentWindowMinutes = null;
  current.membershipStartRule = null;
  payments.mode = "off";
});

describe("saveSalesSettings", () => {
  it("المراجعة أولًا: القديم والجديد، ولا كتابة", async () => {
    const review = await save({ windowMinutes: "1440", startRule: "on_payment" });
    expect(review).toEqual({
      ok: true,
      value: {
        kind: "review",
        current: expect.objectContaining({ orderPaymentWindowMinutes: null }) as unknown,
        next: { orderPaymentWindowMinutes: 1440, membershipStartRule: "on_payment" },
      },
    });
    expect(updateSalesSettings).not.toHaveBeenCalled();
  });

  it("التأكيد يكتب ما رُوجع برمز القفل وباسم المالك", async () => {
    const saved = await save({ windowMinutes: "1440", startRule: "on_payment" }, "confirm");
    expect(saved).toEqual({ ok: true, value: { kind: "saved" } });
    expect(updateSalesSettings).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clubId: "club-1",
        lockToken: "7",
        actor: `staff:${OWNER.id}`,
        settings: { orderPaymentWindowMinutes: 1440, membershipStartRule: "on_payment" },
      }),
    );
  });

  it("بلا افتراضي: نموذج فارغ على قيم غير محسومة لا يغيّر شيئًا ولا يكتب", async () => {
    expect(await save({ windowMinutes: "", startRule: "" })).toEqual({
      ok: false,
      error: { error: "sales_settings.no_changes", fields: {} },
    });
    expect(await save({})).toMatchObject({
      ok: false,
      error: { error: "sales_settings.no_changes" },
    });
  });

  it("ما حُسم لا يعود فارغًا، وأخطاء الحقول بجانبها", async () => {
    current.orderPaymentWindowMinutes = 30;
    current.membershipStartRule = "on_payment";
    expect(await save({ windowMinutes: "", startRule: "soon" })).toEqual({
      ok: false,
      error: {
        error: null,
        fields: {
          windowMinutes: "sales_settings.cannot_unset",
          startRule: "sales_settings.start_rule_invalid",
        },
      },
    });
  });

  it("مع مزوّد دفع مضبوط: المهلة لا تقل عن أقل وقت للدفع مع هامش الجلسة", async () => {
    expect(providerMinimumWindow()).toBeNull();
    payments.mode = "test";
    expect(providerMinimumWindow()).toBe(15);
    expect(await save({ windowMinutes: "14", startRule: "on_payment" })).toMatchObject({
      ok: false,
      error: { fields: { windowMinutes: "sales_settings.window_below_provider_minimum" } },
    });
    expect((await save({ windowMinutes: "15", startRule: "on_payment" })).ok).toBe(true);
  });
});
