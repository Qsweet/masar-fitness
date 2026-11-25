import { err, ok } from "@masar/domain";
import type { PaymentLogFields, ProviderNotification } from "@masar/payments";
import { afterEach, describe, expect, it, vi } from "vitest";

const MAX_BYTES = 64 * 1024;
const SECRET = "shared-secret-for-webhook-unit-tests-only";

const deferred: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
  after: (work: () => Promise<void>) => {
    deferred.push(work);
  },
}));
const handlePaymentNotification = vi.fn(
  (): Promise<Record<string, unknown>> => Promise.resolve({ kind: "synced" }),
);
vi.mock("@masar/payments", () => ({ handlePaymentNotification }));
vi.mock("../checkout/failure", () => ({ logCheckoutFailure: vi.fn() }));

const logs: { level: string; event: string; fields: PaymentLogFields }[] = [];
function log(level: string) {
  return (event: string, fields: PaymentLogFields = {}) => {
    logs.push({ level, event, fields });
  };
}

/** مزوّد وهمي بشكل إشعار بسيط: `{secret, kind}`. توثيقه الحقيقي مختبَر في @masar/payments. */
function parseNotification(rawBody: string) {
  let body: { secret?: unknown; kind?: unknown };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return err("malformed" as const);
  }
  if (body.secret !== SECRET) {
    return err(body.kind === "live" ? ("mode_mismatch" as const) : ("unauthenticated" as const));
  }
  const notifications: Record<string, ProviderNotification> = {
    payment: {
      kind: "payment_update",
      eventId: "e-1",
      eventType: "payment_paid",
      paymentId: "p-1",
      sessionId: "s-1",
    },
    verification: { kind: "endpoint_verification", eventId: "e-2" },
    other: { kind: "unrelated", eventId: "e-3", eventType: "card_auth_failed" },
  };
  return ok(notifications[String(body.kind)] ?? notifications.other);
}

const runtime = {
  current: {
    deps: {
      provider: { id: "moyasar", parseNotification },
      logger: { info: log("info"), warn: log("warn"), error: log("error") },
    },
    fakeStore: null,
  } as unknown,
};
vi.mock("./runtime", () => ({ getPayments: () => runtime.current }));

const { handleWebhook, readLimitedText } = await import("./webhook");

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1/api/payments/webhooks/moyasar", {
    method: "POST",
    body,
    headers,
  });
}

function json(body: unknown): Request {
  return post(JSON.stringify(body));
}

afterEach(() => {
  deferred.length = 0;
  logs.length = 0;
  handlePaymentNotification.mockClear();
});

describe("handleWebhook", () => {
  it("إشعار موثّق: 200 فورًا، والمعالجة بعد الرد لا قبله", async () => {
    const response = await handleWebhook(json({ secret: SECRET, kind: "payment" }), "moyasar");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(handlePaymentNotification).not.toHaveBeenCalled();
    expect(deferred).toHaveLength(1);
    await deferred[0]?.();
    expect(handlePaymentNotification).toHaveBeenCalledTimes(1);
    expect(logs.slice(0, 1)).toEqual([
      {
        level: "info",
        event: "payment.webhook_received",
        fields: { provider: "moyasar", eventId: "e-1", eventType: "payment_paid" },
      },
    ]);
  });

  it("الإشعار نفسه مرتين: ردّان 200 ومعالجتان تحسمهما التسوية عديمة الأثر", async () => {
    const body = { secret: SECRET, kind: "payment" };
    const statuses = [
      await handleWebhook(json(body), "moyasar"),
      await handleWebhook(json(body), "moyasar"),
    ];
    expect(statuses.map((response) => response.status)).toEqual([200, 200]);
    expect(deferred).toHaveLength(2);
  });

  it.each([
    ["سر خاطئ", { secret: "wrong", kind: "payment" }, "unauthenticated"],
    ["سر ناقص", { kind: "payment" }, "unauthenticated"],
    ["بيئة لا تطابق", { secret: "wrong", kind: "live" }, "mode_mismatch"],
  ])("%s: 401 بلا معالجة، والسجل بلا الجسم ولا السر", async (_name, body, reason) => {
    const response = await handleWebhook(json(body), "moyasar");
    expect(response.status).toBe(401);
    expect(deferred).toHaveLength(0);
    expect(logs).toEqual([
      {
        level: "warn",
        event: "payment.webhook_auth_failed",
        fields: { provider: "moyasar", reason },
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain("wrong");
  });

  it("JSON تالف: 400 بلا معالجة ولا سجل توثيق", async () => {
    const response = await handleWebhook(post("{not json"), "moyasar");
    expect(response.status).toBe(400);
    expect(deferred).toHaveLength(0);
    expect(logs).toEqual([]);
  });

  it("جسم أكبر من الحد: 413 قبل التحليل، بالترويسة أو بالقراءة", async () => {
    const big = JSON.stringify({ secret: SECRET, kind: "payment", pad: "x".repeat(MAX_BYTES) });
    expect((await handleWebhook(post(big), "moyasar")).status).toBe(413);
    const declared = post("{}", { "content-length": String(MAX_BYTES + 1) });
    expect((await handleWebhook(declared, "moyasar")).status).toBe(413);
    expect(deferred).toHaveLength(0);
  });

  it("حدث التحقق من الرابط: 200 بتحذير، بلا رمز في السجل وبلا معالجة دفع", async () => {
    const body = { secret: SECRET, kind: "verification", verification_code: "482913" };
    const response = await handleWebhook(json(body), "moyasar");
    expect(response.status).toBe(200);
    expect(deferred).toHaveLength(0);
    expect(logs.map((line) => line.event)).toEqual(["payment.webhook_verification_received"]);
    expect(JSON.stringify(logs)).not.toContain("482913");
  });

  it("حدث لا يخص المدفوعات: 200 بلا معالجة", async () => {
    const response = await handleWebhook(json({ secret: SECRET, kind: "other" }), "moyasar");
    expect(response.status).toBe(200);
    expect(deferred).toHaveLength(0);
  });

  it("مزوّد غير المضبوط، أو لا مزوّد أصلًا: 404 قبل قراءة الجسم", async () => {
    expect((await handleWebhook(json({ secret: SECRET, kind: "payment" }), "tabby")).status).toBe(
      404,
    );
    const configured = runtime.current;
    runtime.current = null;
    try {
      expect(
        (await handleWebhook(json({ secret: SECRET, kind: "payment" }), "moyasar")).status,
      ).toBe(404);
    } finally {
      runtime.current = configured;
    }
    expect(deferred).toHaveLength(0);
  });

  it.each([
    [{ kind: "synced" }, "synced"],
    [{ kind: "busy" }, "busy"],
    [{ kind: "unknown_reference" }, "unknown_reference"],
    [{ kind: "skipped", reason: "other_provider" }, "skipped:other_provider"],
  ])("نتيجة المعالجة تُسجَّل بنوعها بلا بيانات شخصية: %j", async (result, reason) => {
    handlePaymentNotification.mockResolvedValueOnce(result);
    await handleWebhook(json({ secret: SECRET, kind: "payment" }), "moyasar");
    await deferred[0]?.();
    expect(logs.at(-1)).toEqual({
      level: "info",
      event: "payment.webhook_processed",
      fields: { provider: "moyasar", eventId: "e-1", eventType: "payment_paid", reason },
    });
  });

  it("تعذّر قراءة المزوّد يُسجَّل بنوع الخطأ ورمزه", async () => {
    const error = { kind: "unreachable", code: "network_or_timeout" };
    handlePaymentNotification.mockResolvedValueOnce({ kind: "provider_error", error });
    await handleWebhook(json({ secret: SECRET, kind: "payment" }), "moyasar");
    await deferred[0]?.();
    expect(logs.at(-1)?.fields).toMatchObject({
      reason: "provider_error",
      errorKind: "unreachable",
      errorCode: "network_or_timeout",
    });
  });

  it("عطل في المعالجة بعد الرد لا يُرمى: يُسجَّل والمطابقة تعيد", async () => {
    handlePaymentNotification.mockRejectedValueOnce(new Error("db down"));
    await handleWebhook(json({ secret: SECRET, kind: "payment" }), "moyasar");
    await expect(deferred[0]?.()).resolves.toBeUndefined();
  });
});

describe("readLimitedText", () => {
  it("يقرأ النص كاملًا ضمن الحد، ومنه العربي متعدد البايتات", async () => {
    const text = JSON.stringify({ note: "طلب رقم MSR-0001000" });
    expect(await readLimitedText(post(text), MAX_BYTES)).toBe(text);
  });

  it("الحد بالبايت لا بالمحرف، وعنده تمامًا يُقبل", async () => {
    const text = "ط".repeat(10);
    const bytes = new TextEncoder().encode(text).byteLength;
    expect(await readLimitedText(post(text), bytes)).toBe(text);
    expect(await readLimitedText(post(text), bytes - 1)).toBeNull();
  });

  it("جسم فارغ نص فارغ", async () => {
    const empty = new Request("http://127.0.0.1/hook", { method: "POST" });
    expect(await readLimitedText(empty, MAX_BYTES)).toBe("");
  });
});
