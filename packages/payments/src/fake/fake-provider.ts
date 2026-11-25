/**
 * مزوّد اختبار حتمي في الذاكرة: للاختبارات وللعرض التجريبي المحلي فقط. لا شبكة ولا مال حقيقي.
 * يحاكي جلسة دفع مستضافة ودفعاتها، ويُتحكَّم بنتيجتها من `FakeProviderStore`. معرّفاته مشتقة من
 * معرّف المحاولة، فهي حتمية وفريدة. ذاكرته تزول بإعادة تشغيل العملية، فالجلسة المفقودة منتهية.
 */
import {
  err,
  ok,
  type ProviderPaymentSnapshot,
  type ProviderPaymentState,
  type ProviderSessionState,
  type Result,
} from "@masar/domain";
import {
  ProviderError,
  type HostedPayment,
  type HostedPaymentRequest,
  type NotificationRejection,
  type PaymentProvider,
  type ProviderNotification,
  type SessionView,
} from "../port";
import { secretsEqual } from "../secret";

export const FAKE_PROVIDER_ID = "fake";
const SESSION_PREFIX = "fake_s_";
const PAYMENT_PREFIX = "fake_p_";
const SESSION_ID_PATTERN = /^fake_s_([0-9a-f-]{36})$/;
const FAKE_METHOD = "fake_card";

export interface FakePayment {
  readonly paymentId: string;
  state: ProviderPaymentState;
  readonly amountMinor: number;
  readonly currency: string;
  readonly couponApplied: boolean;
}

export interface FakeSession {
  readonly sessionId: string;
  readonly request: HostedPaymentRequest;
  state: ProviderSessionState;
  readonly payments: FakePayment[];
}

export interface FakePaymentInput {
  readonly state: ProviderPaymentState;
  /** إن غاب فمبلغ الجلسة وعملتها. */
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly couponApplied?: boolean;
}

/** حالة مزوّد الاختبار. تحفظها العملية (على globalThis في الويب) وتتحكم بها الاختبارات وصفحة العرض. */
export class FakeProviderStore {
  private readonly sessions = new Map<string, FakeSession>();
  /** عدد قراءات الجلسات: تثبت به الاختبارات أن مزامنتين متوازيتين تنفّذ واحدة الاستدعاء. */
  fetchCount = 0;

  open(request: HostedPaymentRequest): FakeSession {
    const sessionId = `${SESSION_PREFIX}${request.attemptId}`;
    const session: FakeSession = { sessionId, request, state: "open", payments: [] };
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId: string): FakeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** يضيف دفعة على الجلسة بالحالة المطلوبة ويرجعها، أو undefined إن لم توجد الجلسة أو أُغلقت. */
  addPayment(sessionId: string, input: FakePaymentInput): FakePayment | undefined {
    const session = this.sessions.get(sessionId);
    if (session?.state !== "open") {
      return undefined;
    }
    const index = String(session.payments.length + 1);
    const payment: FakePayment = {
      paymentId: `${PAYMENT_PREFIX}${session.request.attemptId}_${index}`,
      state: input.state,
      amountMinor: input.amountMinor ?? session.request.amountMinor,
      currency: input.currency ?? session.request.currency,
      couponApplied: input.couponApplied ?? false,
    };
    session.payments.push(payment);
    return payment;
  }

  setPaymentState(paymentId: string, state: ProviderPaymentState): boolean {
    const payment = this.findPayment(paymentId)?.payment;
    if (payment === undefined) {
      return false;
    }
    payment.state = state;
    return true;
  }

  close(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return false;
    }
    session.state = "closed";
    return true;
  }

  findPayment(paymentId: string): { session: FakeSession; payment: FakePayment } | undefined {
    for (const session of this.sessions.values()) {
      const payment = session.payments.find((candidate) => candidate.paymentId === paymentId);
      if (payment !== undefined) {
        return { session, payment };
      }
    }
    return undefined;
  }

  sessionsForAttempt(attemptId: string): string[] {
    return [...this.sessions.values()]
      .filter((session) => session.request.attemptId === attemptId)
      .map((session) => session.sessionId);
  }
}

export interface FakeProviderOptions {
  readonly store: FakeProviderStore;
  readonly webhookSecret: string;
  /** رابط صفحة الدفع التجريبية لجلسة (صفحة داخل موقعنا في وضع العرض). */
  readonly hostedPageUrl: (sessionId: string) => string;
  readonly clock: () => Date;
}

function toSnapshotPayment(session: FakeSession, payment: FakePayment): ProviderPaymentSnapshot {
  return {
    paymentId: payment.paymentId,
    state: payment.state,
    rawStatus: payment.state,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    sessionId: session.sessionId,
    method: FAKE_METHOD,
    couponApplied: payment.couponApplied,
  };
}

/** الجلسة تُغلق عند موعدها كما يفعل المزوّد الحقيقي، بلا مؤقت: تُحسب عند القراءة. */
function effectiveState(session: FakeSession, now: Date): ProviderSessionState {
  const expired = now.getTime() >= session.request.expiresAt.getTime();
  return session.state === "open" && expired ? "closed" : session.state;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function parseBody(rawBody: string): Readonly<Record<string, unknown>> | undefined {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** شكل إشعار مزوّد الاختبار: `{secret, event_id, payment_id?, session_id?}`. */
function parseFakeNotification(
  rawBody: string,
  webhookSecret: string,
): Result<ProviderNotification, NotificationRejection> {
  const body = parseBody(rawBody);
  if (body === undefined) {
    return err("malformed");
  }
  const secret = body.secret;
  if (typeof secret !== "string" || !secretsEqual(secret, webhookSecret)) {
    return err("unauthenticated");
  }
  return ok({
    kind: "payment_update",
    eventId: optionalString(body.event_id),
    eventType: "payment_update",
    paymentId: optionalString(body.payment_id),
    sessionId: optionalString(body.session_id),
  });
}

export function createFakeProvider(options: FakeProviderOptions): PaymentProvider {
  const { store, clock } = options;

  function view(sessionId: string): Result<SessionView, ProviderError> {
    store.fetchCount += 1;
    const session = store.get(sessionId);
    if (session !== undefined) {
      const state = effectiveState(session, clock());
      const snapshot = {
        provider: FAKE_PROVIDER_ID,
        sessionId,
        mode: "test" as const,
        state,
        rawStatus: state,
        attemptId: session.request.attemptId,
        payments: session.payments.map((payment) => toSnapshotPayment(session, payment)),
      };
      return ok({
        snapshot,
        redirectUrl: state === "open" ? options.hostedPageUrl(sessionId) : null,
      });
    }
    const attemptId = SESSION_ID_PATTERN.exec(sessionId)?.[1];
    if (attemptId === undefined) {
      return err(new ProviderError("not_found", { code: "fake_session_unknown" }));
    }
    // ذاكرة المزوّد زالت بإعادة التشغيل: الجلسة المفقودة منتهية بلا دفعات
    const lost = { provider: FAKE_PROVIDER_ID, sessionId, mode: "test" as const, attemptId };
    const snapshot = { ...lost, state: "closed" as const, rawStatus: "lost", payments: [] };
    return ok({ snapshot, redirectUrl: null });
  }

  return {
    id: FAKE_PROVIDER_ID,
    mode: "test",
    createHostedPayment(request): Promise<Result<HostedPayment, ProviderError>> {
      const session = store.open(request);
      const redirectUrl = options.hostedPageUrl(session.sessionId);
      return Promise.resolve(ok({ sessionId: session.sessionId, redirectUrl, rawStatus: "open" }));
    },
    fetchSession: (sessionId) => Promise.resolve(view(sessionId)),
    fetchPaymentSession(paymentId) {
      const found = store.findPayment(paymentId);
      return Promise.resolve(ok(found?.session.sessionId ?? null));
    },
    cancelSession(sessionId) {
      store.close(sessionId);
      return Promise.resolve(ok(undefined));
    },
    findSessionsForAttempt: (attemptId) => Promise.resolve(ok(store.sessionsForAttempt(attemptId))),
    parseNotification: (rawBody) => parseFakeNotification(rawBody, options.webhookSecret),
  };
}
