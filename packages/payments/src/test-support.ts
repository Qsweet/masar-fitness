/** عدّة اختبارات تكامل تنسيق الدفع: قاعدة اختبار حقيقية، ومزوّد الاختبار، وساعة يتحكم بها الاختبار. */
import { createOrder, findAttemptById, type Db, type PaymentAttemptRecord } from "@masar/db";
import {
  orderInput,
  testBuyer,
  testPhone,
  TEST_MIN_PAYMENT_MINUTES,
  TEST_NOW,
  unwrap,
} from "@masar/db/test-support";
import type { PaymentDeps } from "./deps";
import { createFakeProvider, FakeProviderStore } from "./fake/fake-provider";
import type { PaymentLogEvent, PaymentLogFields, PaymentLogger } from "./log";
import type { PaymentProvider } from "./port";
import { startPayment, type StartPaymentResult } from "./start";

export const FAKE_SECRET = "fake-webhook-secret-for-integration-tests";
export const RETURN_URL = "http://127.0.0.1/checkout/orders/token/return";
const MINUTE_MS = 60_000;

export interface LogLine {
  readonly level: "info" | "warn" | "error";
  readonly event: PaymentLogEvent;
  readonly fields: PaymentLogFields;
}

export interface Harness {
  readonly deps: PaymentDeps;
  readonly store: FakeProviderStore;
  readonly logs: LogLine[];
  /** يحرّك ساعة الاختبار إلى `TEST_NOW + minutes`. */
  setMinutes(minutes: number): void;
  /** يستبدل المزوّد (مزوّد يفشل مثلًا) مع بقاء القاعدة والساعة والسجل. */
  withProvider(provider: PaymentProvider): PaymentDeps;
}

export function createHarness(db: Db): Harness {
  let now = TEST_NOW;
  const clock = (): Date => now;
  const logs: LogLine[] = [];
  const log =
    (level: LogLine["level"]) =>
    (event: PaymentLogEvent, fields: PaymentLogFields = {}) => {
      logs.push({ level, event, fields });
    };
  const logger: PaymentLogger = { info: log("info"), warn: log("warn"), error: log("error") };
  const store = new FakeProviderStore();
  const provider = createFakeProvider({
    store,
    webhookSecret: FAKE_SECRET,
    hostedPageUrl: (sessionId) => `http://127.0.0.1/checkout/demo-pay/${sessionId}`,
    clock,
  });
  const deps = { db, provider, logger, clock, minPaymentMinutes: TEST_MIN_PAYMENT_MINUTES };
  return {
    deps,
    store,
    logs,
    setMinutes(minutes) {
      now = new Date(TEST_NOW.getTime() + minutes * MINUTE_MS);
    },
    withProvider: (replacement) => ({ ...deps, provider: replacement }),
  };
}

let phoneIndex = 0;

/** طلب معلّق جديد لعميل مختلف في كل مرة. */
export async function newPendingOrder(db: Db, planSlug: string, priceMinor: number) {
  phoneIndex += 1;
  const input = orderInput(planSlug, priceMinor, { buyer: testBuyer(testPhone(phoneIndex)) });
  return unwrap(await createOrder(db, input)).orderId;
}

export function start(deps: PaymentDeps, orderId: string) {
  return startPayment(deps, {
    orderId,
    describe: (reference) => `طلب ${reference}`,
    successUrl: RETURN_URL,
    backUrl: RETURN_URL,
  });
}

/** يبدأ الدفع ويتوقع توجيهًا إلى صفحة المزوّد، ويرجع صف المحاولة. */
export async function startRedirect(
  deps: PaymentDeps,
  orderId: string,
): Promise<{
  result: Extract<StartPaymentResult, { kind: "redirect" }>;
  attempt: PaymentAttemptRecord;
}> {
  const result = unwrap(await start(deps, orderId));
  if (result.kind !== "redirect") {
    throw new Error("توقعنا توجيهًا إلى صفحة الدفع");
  }
  const attempt = await findAttemptById(deps.db, result.attemptId);
  if (attempt === undefined) {
    throw new Error("المحاولة غير موجودة بعد بدء الدفع");
  }
  return { result, attempt };
}
