import { describe, expect, it } from "vitest";
import type { HostedPaymentRequest } from "../port";
import { createFakeProvider, FakeProviderStore } from "./fake-provider";

const ATTEMPT_ID = "0193a000-0000-7000-8000-000000000001";
const SECRET = "fake-webhook-secret-for-unit-tests-only";
const EXPIRES = new Date("2026-06-15T09:25:00Z");
const BEFORE = new Date("2026-06-15T09:10:00Z");

const REQUEST: HostedPaymentRequest = {
  attemptId: ATTEMPT_ID,
  orderReference: "MSR-0001000",
  amountMinor: 90_000,
  currency: "SAR",
  description: "MSR-0001000",
  expiresAt: EXPIRES,
  successUrl: "http://127.0.0.1/return",
  backUrl: "http://127.0.0.1/return",
};

function setup(now = BEFORE) {
  const store = new FakeProviderStore();
  const provider = createFakeProvider({
    store,
    webhookSecret: SECRET,
    hostedPageUrl: (sessionId) => `http://127.0.0.1/demo-pay/${sessionId}`,
    clock: () => now,
  });
  return { store, provider };
}

async function created(now = BEFORE) {
  const context = setup(now);
  const hosted = await context.provider.createHostedPayment(REQUEST);
  if (!hosted.ok) {
    throw hosted.error;
  }
  return { ...context, hosted: hosted.value };
}

describe("مزوّد الاختبار", () => {
  it("معرّف الجلسة حتمي من معرّف المحاولة، والرابط صفحة العرض", async () => {
    const { hosted } = await created();
    expect(hosted).toEqual({
      sessionId: `fake_s_${ATTEMPT_ID}`,
      redirectUrl: `http://127.0.0.1/demo-pay/fake_s_${ATTEMPT_ID}`,
      rawStatus: "open",
    });
  });

  it("الجلسة المفتوحة بلا دفعات، ثم دفعة مدفوعة بمبلغ الجلسة", async () => {
    const { provider, store, hosted } = await created();
    const open = await provider.fetchSession(hosted.sessionId);
    expect(open).toMatchObject({
      ok: true,
      value: {
        redirectUrl: hosted.redirectUrl,
        snapshot: {
          provider: "fake",
          mode: "test",
          state: "open",
          attemptId: ATTEMPT_ID,
          payments: [],
        },
      },
    });
    const payment = store.addPayment(hosted.sessionId, { state: "paid" });
    const paid = await provider.fetchSession(hosted.sessionId);
    expect(paid).toMatchObject({
      ok: true,
      value: {
        snapshot: {
          payments: [
            {
              paymentId: `fake_p_${ATTEMPT_ID}_1`,
              state: "paid",
              amountMinor: 90_000,
              currency: "SAR",
              sessionId: hosted.sessionId,
            },
          ],
        },
      },
    });
    expect(await provider.fetchPaymentSession(payment?.paymentId ?? "")).toEqual({
      ok: true,
      value: hosted.sessionId,
    });
    expect(store.fetchCount).toBe(2);
  });

  it("الجلسة تُغلق عند موعدها أو بالإلغاء، والمغلقة لا تقبل دفعة", async () => {
    const atDeadline = await created(EXPIRES);
    const expired = await atDeadline.provider.fetchSession(atDeadline.hosted.sessionId);
    expect(expired).toMatchObject({
      ok: true,
      value: { redirectUrl: null, snapshot: { state: "closed" } },
    });
    const { provider, store, hosted } = await created();
    await provider.cancelSession(hosted.sessionId);
    expect(store.addPayment(hosted.sessionId, { state: "paid" })).toBeUndefined();
    const cancelled = await provider.fetchSession(hosted.sessionId);
    expect(cancelled).toMatchObject({
      ok: true,
      value: { snapshot: { state: "closed", payments: [] } },
    });
  });

  it("جلسة زالت من الذاكرة منتهية بلا دفعات، ومعرّف بشكل غريب غير موجود", async () => {
    const { provider } = setup();
    const lost = await provider.fetchSession(`fake_s_${ATTEMPT_ID}`);
    expect(lost).toMatchObject({
      ok: true,
      value: { snapshot: { state: "closed", rawStatus: "lost", attemptId: ATTEMPT_ID } },
    });
    const unknown = await provider.fetchSession("something-else");
    expect(unknown.ok ? null : unknown.error.kind).toBe("not_found");
  });

  it("جلسات المحاولة تُعرف بمعرّفها (الجلسة اليتيمة)", async () => {
    const { provider, hosted } = await created();
    expect(await provider.findSessionsForAttempt(ATTEMPT_ID)).toEqual({
      ok: true,
      value: [hosted.sessionId],
    });
    expect(await provider.findSessionsForAttempt("another")).toEqual({ ok: true, value: [] });
  });
});

describe("إشعار مزوّد الاختبار", () => {
  const { provider } = setup();

  it("سر صحيح: تُستخرج المعرّفات فقط", () => {
    const body = {
      secret: SECRET,
      event_id: "e-1",
      payment_id: "p-1",
      session_id: "s-1",
      status: "paid",
    };
    expect(provider.parseNotification(JSON.stringify(body))).toEqual({
      ok: true,
      value: {
        kind: "payment_update",
        eventId: "e-1",
        eventType: "payment_update",
        paymentId: "p-1",
        sessionId: "s-1",
      },
    });
  });

  it.each([
    ["سر خاطئ", { secret: `${SECRET}x` }],
    ["سر فارغ", { secret: "" }],
    ["سر ناقص", {}],
    ["سر ليس نصًا", { secret: 123 }],
  ])("%s ⇒ unauthenticated", (_name, body) => {
    expect(provider.parseNotification(JSON.stringify(body))).toEqual({
      ok: false,
      error: "unauthenticated",
    });
  });

  it.each(["", "not json", "[]", '"text"', "null"])("جسم تالف ⇒ malformed: %s", (raw) => {
    expect(provider.parseNotification(raw)).toEqual({ ok: false, error: "malformed" });
  });
});
