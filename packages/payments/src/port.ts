/**
 * منفذ مزوّد الدفع: واجهة واحدة يطبّقها كل محوّل (Moyasar الآن، وTabby وTamara في 4ب، ومزوّد
 * الاختبار). المحوّل لا يعرف شيئًا عن الطلبات والاشتراكات: ينشئ جلسة دفع مستضافة عند المزوّد،
 * ويقرأ حالتها بالمفتاح السري، ويلغيها، ويوثّق مصدر الإشعار. التفعيل في طبقة أخرى.
 */
import type { ProviderMode, ProviderSessionSnapshot, Result } from "@masar/domain";

export const PROVIDER_ERROR_KINDS = [
  /** انقطاع أو مهلة أو 5xx: النتيجة عند المزوّد مجهولة. */
  "unreachable",
  /** المزوّد رفض الطلب (4xx). */
  "rejected",
  "unauthorized",
  "not_found",
  /** رد لا يطابق الشكل الموثق: لا يُخمَّن معناه. */
  "malformed_response",
  /** سلوك غير موثق لا يُحسم إلا بتجربة في البيئة التجريبية (WP0). */
  "needs_sandbox_verification",
] as const;

export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];

export interface ProviderErrorDetails {
  readonly httpStatus?: number;
  /** رمز آلي (نوع الخطأ عند المزوّد أو اسم الفحص الذي فشل). لا نص حر من المزوّد أبدًا. */
  readonly code?: string;
  readonly cause?: unknown;
}

/** عطل في التعامل مع المزوّد. رسالته ثابتة من النوع والرمز فقط، فتُسجَّل بلا تنقيح. */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly httpStatus: number | null;
  readonly code: string | null;

  constructor(kind: ProviderErrorKind, details: ProviderErrorDetails = {}) {
    const code = details.code ?? null;
    super(code === null ? kind : `${kind}: ${code}`, { cause: details.cause });
    this.name = "ProviderError";
    this.kind = kind;
    this.httpStatus = details.httpStatus ?? null;
    this.code = code;
  }
}

/** طلب إنشاء صفحة دفع مستضافة لمحاولة. لا اسم ولا جوال ولا بيانات بطاقة. */
export interface HostedPaymentRequest {
  readonly attemptId: string;
  /** مرجع الطلب الظاهر `MSR-…`. */
  readonly orderReference: string;
  /** بالهللة، عدد صحيح. */
  readonly amountMinor: number;
  readonly currency: string;
  /** نص يراه العميل في صفحة المزوّد: من القاموس، وفيه المرجع فقط. */
  readonly description: string;
  /** لا يُقبل الدفع بعده (`payment_attempts.deadline_at`). */
  readonly expiresAt: Date;
  readonly successUrl: string;
  readonly backUrl: string;
}

export interface HostedPayment {
  readonly sessionId: string;
  /** صفحة الدفع على نطاق المزوّد. */
  readonly redirectUrl: string;
  readonly rawStatus: string;
}

export interface SessionView {
  readonly snapshot: ProviderSessionSnapshot;
  /** صفحة الدفع إن كانت الجلسة ما زالت تُعرض، ليعود إليها العميل. */
  readonly redirectUrl: string | null;
}

/**
 * إشعار وُثّق مصدره. **منبّه فقط**: لا يُستعمل من جسمه إلا معرّفات تحدد أي محاولة تُقرأ من المزوّد.
 */
export type ProviderNotification =
  | {
      readonly kind: "payment_update";
      readonly eventId: string | null;
      readonly eventType: string;
      readonly paymentId: string | null;
      readonly sessionId: string | null;
    }
  /** المزوّد يتحقق من ملكية رابط الإشعار برمز لمرة واحدة. */
  | { readonly kind: "endpoint_verification"; readonly eventId: string | null }
  /** حدث موثّق المصدر لا يخص المدفوعات (يُرد عليه 2xx ويُتجاهل). */
  | { readonly kind: "unrelated"; readonly eventId: string | null; readonly eventType: string };

export type NotificationRejection = "malformed" | "unauthenticated" | "mode_mismatch";

export interface PaymentProvider {
  /** يطابق `payment_attempts.provider` ومقطع رابط الإشعار. */
  readonly id: string;
  readonly mode: ProviderMode;
  /** ينشئ صفحة دفع مستضافة. لا يُعاد تلقائيًا عند الانقطاع: قد تنشأ جلستان قابلتان للدفع. */
  createHostedPayment(request: HostedPaymentRequest): Promise<Result<HostedPayment, ProviderError>>;
  /** يقرأ الجلسة وكل دفعاتها من المزوّد بالمفتاح السري: مصدر الحقيقة الوحيد قبل أي تفعيل. */
  fetchSession(sessionId: string): Promise<Result<SessionView, ProviderError>>;
  /** الجلسة التي تخصها دفعة، من قراءة خادمية (لإشعار لا يذكر جلسته). null إن لم تكن لجلسة. */
  fetchPaymentSession(paymentId: string): Promise<Result<string | null, ProviderError>>;
  /** يلغي الجلسة فلا تقبل دفعًا جديدًا. */
  cancelSession(sessionId: string): Promise<Result<void, ProviderError>>;
  /** الجلسات التي أنشأها المزوّد لمحاولة (جلسة يتيمة بعد انقطاع الإنشاء). */
  findSessionsForAttempt(attemptId: string): Promise<Result<readonly string[], ProviderError>>;
  /** يوثّق مصدر الإشعار بالسر المشترك بمقارنة ثابتة الزمن، ثم يستخرج المعرّفات فقط. */
  parseNotification(rawBody: string): Result<ProviderNotification, NotificationRejection>;
}
