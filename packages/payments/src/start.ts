/**
 * بدء الدفع: صف المحاولة `created` تحت قفل الطلب، ثم استدعاء المزوّد **خارج أي معاملة**، ثم
 * `pending` بمعرّف الجلسة. فشل الاستدعاء أو انقطاعه يكتب المحاولة `failed` بلا إعادة تلقائية (رابط
 * الدفع لم يصل إلى العميل، فلا مال يضيع)، ويستطيع العميل البدء من جديد.
 */
import {
  createPaymentAttempt,
  markAttemptStartFailed,
  markSessionOpened,
  type PaymentAttemptRecord,
} from "@masar/db";
import { DomainError, err, ok, type Result } from "@masar/domain";
import type { PaymentDeps } from "./deps";
import { ProviderError, type HostedPayment } from "./port";

export interface StartPaymentInput {
  readonly orderId: string;
  /** وصف يراه العميل في صفحة المزوّد، يُبنى من مرجع الطلب بنص القاموس. */
  readonly describe: (orderReference: string) => string;
  readonly successUrl: string;
  readonly backUrl: string;
}

export type StartPaymentResult =
  /** يُوجَّه العميل إلى صفحة الدفع على نطاق المزوّد. */
  | { readonly kind: "redirect"; readonly attemptId: string; readonly url: string }
  /** للطلب محاولة حيّة لا تُعرض صفحتها الآن: يُتحقق منها ولا تُفتح جلسة ثانية. */
  | { readonly kind: "verify"; readonly attemptId: string };

const UNAVAILABLE = "payment.provider_unavailable";

/** محاولة حيّة قائمة: يعود العميل إلى صفحتها إن كانت الجلسة ما زالت مفتوحة عند المزوّد. */
async function resume(
  deps: PaymentDeps,
  attempt: PaymentAttemptRecord,
): Promise<StartPaymentResult> {
  const verify: StartPaymentResult = { kind: "verify", attemptId: attempt.id };
  if (attempt.status !== "pending" || attempt.providerSessionId === null) {
    return verify;
  }
  const view = await deps.provider.fetchSession(attempt.providerSessionId);
  if (!view.ok || view.value.redirectUrl === null || view.value.snapshot.state !== "open") {
    return verify;
  }
  return { kind: "redirect", attemptId: attempt.id, url: view.value.redirectUrl };
}

async function createSession(
  deps: PaymentDeps,
  attempt: PaymentAttemptRecord,
  orderReference: string,
  input: StartPaymentInput,
): Promise<Result<HostedPayment, ProviderError>> {
  try {
    return await deps.provider.createHostedPayment({
      attemptId: attempt.id,
      orderReference,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      description: input.describe(orderReference),
      expiresAt: attempt.deadlineAt,
      successUrl: input.successUrl,
      backUrl: input.backUrl,
    });
  } catch {
    // عطل غير متوقع في المحوّل يُعامل كانقطاع: المحاولة لا تبقى created
    return err(new ProviderError("unreachable", { code: "adapter_exception" }));
  }
}

async function failStart(
  deps: PaymentDeps,
  attempt: PaymentAttemptRecord,
  error: ProviderError,
): Promise<Result<never, DomainError>> {
  const reason = error.kind === "unreachable" ? "provider_unreachable" : "provider_rejected";
  await markAttemptStartFailed(deps.db, { attemptId: attempt.id, reason, now: deps.clock() });
  deps.logger.error("payment.attempt_start_failed", {
    attemptId: attempt.id,
    provider: attempt.provider,
    reason,
    errorKind: error.kind,
    errorCode: error.code,
    httpStatus: error.httpStatus,
  });
  return err(new DomainError("conflict", UNAVAILABLE));
}

/**
 * يبدأ محاولة دفع لطلب معلّق ويرجع وجهة العميل. عديم الأثر عند التكرار: ضغطتان على «ادفع» محاولة
 * واحدة وجلسة واحدة. أخطاء العمل (`order.not_payable`، `payment.window_too_short`،
 * `payment.attempt_in_progress`، `payment.provider_unavailable`) نتيجة لا استثناء.
 */
export async function startPayment(
  deps: PaymentDeps,
  input: StartPaymentInput,
): Promise<Result<StartPaymentResult, DomainError>> {
  const started = await createPaymentAttempt(deps.db, {
    orderId: input.orderId,
    provider: deps.provider.id,
    providerMode: deps.provider.mode,
    minPaymentMinutes: deps.minPaymentMinutes,
    now: deps.clock(),
  });
  if (!started.ok) {
    return started;
  }
  const { attempt, reused, orderReference } = started.value;
  if (reused) {
    return ok(await resume(deps, attempt));
  }
  deps.logger.info("payment.attempt_created", {
    attemptId: attempt.id,
    provider: attempt.provider,
  });
  const hosted = await createSession(deps, attempt, orderReference, input);
  if (!hosted.ok) {
    return failStart(deps, attempt, hosted.error);
  }
  const opened = await markSessionOpened(deps.db, {
    attemptId: attempt.id,
    providerSessionId: hosted.value.sessionId,
    providerStatus: hosted.value.rawStatus,
    now: deps.clock(),
  });
  if (!opened.ok) {
    // المحاولة لم تعد created (فُشّلت كبداية منقطعة): الجلسة لا تُترك قابلة للدفع
    await deps.provider.cancelSession(hosted.value.sessionId);
    return err(new DomainError("conflict", UNAVAILABLE));
  }
  return ok({ kind: "redirect", attemptId: attempt.id, url: hosted.value.redirectUrl });
}
