/** مساعدات اختبارات الدفع: لقطات مزوّد اختبارية، وإنهاء طلب قسرًا بتجاوز السدّ الاحتياطي. قيم اختبار فقط. */
import type {
  ProviderPaymentSnapshot,
  ProviderPaymentState,
  ProviderSessionSnapshot,
} from "@masar/domain";
import type { Db } from "../client";
import type { Prisma } from "../generated/prisma/client";
import {
  applyProviderSnapshot,
  createPaymentAttempt,
  markSessionOpened,
  type PaymentAttemptRecord,
  type SyncOutcome,
} from "../payments";
import { TEST_NOW } from "./commerce-constants";
import { unwrap } from "./commerce-orders";
import { assertTestDatabase } from "./reset-database";

export const TEST_PROVIDER = "test_pay";
/** أقل وقت للدفع في الاختبارات بالدقائق (قيمة اختبار، لا قياس WP0). */
export const TEST_MIN_PAYMENT_MINUTES = 10;
export const TEST_STUCK_AFTER_MS = 3_600_000;

export function testSessionId(attemptId: string): string {
  return `ts_${attemptId}`;
}

export function testPaymentId(attemptId: string, index = 1): string {
  return `tp_${attemptId}_${String(index)}`;
}

/** دفعة على جلسة المحاولة بمبلغها وعملتها، يُغيَّر منها ما يلزم الاختبار. */
export function paymentSnapshot(
  attempt: PaymentAttemptRecord,
  state: ProviderPaymentState,
  overrides: Partial<ProviderPaymentSnapshot> = {},
): ProviderPaymentSnapshot {
  return {
    paymentId: testPaymentId(attempt.id),
    state,
    rawStatus: state,
    amountMinor: attempt.amountMinor,
    currency: attempt.currency,
    sessionId: attempt.providerSessionId,
    method: "creditcard",
    couponApplied: false,
    ...overrides,
  };
}

/** لقطة جلسة تطابق مراجع المحاولة، يُغيَّر منها ما يلزم الاختبار. */
export function sessionSnapshot(
  attempt: PaymentAttemptRecord,
  payments: readonly ProviderPaymentSnapshot[] = [],
  overrides: Partial<ProviderSessionSnapshot> = {},
): ProviderSessionSnapshot {
  return {
    provider: attempt.provider,
    sessionId: attempt.providerSessionId ?? "",
    mode: attempt.providerMode,
    state: "open",
    rawStatus: "open",
    attemptId: attempt.id,
    payments,
    ...overrides,
  };
}

const BACKSTOP_TRIGGER = "orders_forbid_expiry_with_live_attempt";

/**
 * يكتب الطلب منتهيًا ولو كانت له محاولة حيّة، بتعطيل السدّ الاحتياطي داخل معاملة واحدة. يحاكي ما
 * يمنعه الطريق العادي (دفعة تصل لطلب منتهٍ) ليُختبر `order.not_payable` وحادثته. قاعدة اختبار فقط.
 */
export async function forceExpireOrder(db: Db, orderId: string): Promise<void> {
  await assertTestDatabase(db);
  await db.$transaction([
    db.$executeRawUnsafe(`ALTER TABLE orders DISABLE TRIGGER ${BACKSTOP_TRIGGER}`),
    db.$executeRaw`
      UPDATE orders SET status = 'expired', expired_at = expires_at WHERE id = ${orderId}::uuid`,
    db.$executeRawUnsafe(`ALTER TABLE orders ENABLE TRIGGER ${BACKSTOP_TRIGGER}`),
  ]);
}

const MINUTE_MS = 60_000;
/** موعد محاولة الإدراج الخام: قبل مهلة طلب الاختبار (30 دقيقة). */
const RAW_DEADLINE_MINUTES = 20;

export type RawAttemptInput = Pick<
  Prisma.PaymentAttemptUncheckedCreateInput,
  "clubId" | "orderId"
> &
  Partial<Prisma.PaymentAttemptUncheckedCreateInput>;

/** إدراج محاولة مباشرة بقيم صالحة لطلب اختبار سعره `amountMinor`: يختبر القاعدة لا طبقة الكود. */
export function insertRawAttempt(db: Db, input: RawAttemptInput & { amountMinor: number }) {
  return db.paymentAttempt.create({
    data: {
      provider: TEST_PROVIDER,
      providerMode: "test",
      currency: "SAR",
      deadlineAt: new Date(TEST_NOW.getTime() + RAW_DEADLINE_MINUTES * MINUTE_MS),
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      ...input,
    },
  });
}

/** تحديث خام لمحاولة بنص SQL ثابت من الاختبار نفسه. */
export function setRawAttempt(db: Db, attemptId: string, assignment: string): Promise<number> {
  return db.$executeRawUnsafe(
    `UPDATE payment_attempts SET ${assignment} WHERE id = $1::uuid`,
    attemptId,
  );
}

/** محاولة pending فُتحت جلستها عند مزوّد الاختبار، عبر طبقة الكود. */
export async function openTestAttempt(db: Db, orderId: string): Promise<PaymentAttemptRecord> {
  const { attempt } = unwrap(
    await createPaymentAttempt(db, {
      orderId,
      provider: TEST_PROVIDER,
      providerMode: "test",
      minPaymentMinutes: TEST_MIN_PAYMENT_MINUTES,
      now: TEST_NOW,
    }),
  );
  return unwrap(
    await markSessionOpened(db, {
      attemptId: attempt.id,
      providerSessionId: testSessionId(attempt.id),
      providerStatus: "open",
      now: TEST_NOW,
    }),
  );
}

/** يطبّق لقطة على المحاولة ويرجع نتيجتها الناجحة. */
export function applyTestSnapshot(
  db: Db,
  attempt: PaymentAttemptRecord,
  snapshot: ProviderSessionSnapshot,
  now: Date,
): Promise<SyncOutcome> {
  const input = { attemptId: attempt.id, snapshot, now, stuckAlertAfterMs: TEST_STUCK_AFTER_MS };
  return applyProviderSnapshot(db, input).then(unwrap);
}
