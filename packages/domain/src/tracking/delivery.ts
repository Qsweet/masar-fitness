import type { ServerProvider } from "./providers";

/**
 * قرار ما بعد محاولة إرسال (ADMIN_A5_TRACKING §4.2). الإعادة لما قد ينجح لاحقًا فقط؛ خطأ الحمولة
 * أو المفتاح لا تصلحه الإعادة فيموت فورًا، ويظهر في سجل اللوحة.
 */
export const MAX_DELIVERY_ATTEMPTS = 6;
/** الانتظار قبل المحاولة التالية بالدقائق، بعدد المحاولات المنتهية. */
const BACKOFF_MINUTES: Readonly<Record<number, number>> = { 1: 1, 2: 5, 3: 30, 4: 120, 5: 720 };
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
/**
 * أقصى عمر للحدث تقبله المنصة: ميتا 7 أيام، GA4 72 ساعة، OpenAI 167 ساعة (حدها «within the last 7
 * days»، https://developers.openai.com/ads/conversions-api، بهامش ساعة لزمن الإرسال والإعادة: مراجعة
 * القرار 91)؛ سناب وتيك توك بلا حد موثَّق فنأخذ 7 أيام.
 */
const MAX_AGE_HOURS: Readonly<Record<ServerProvider, number>> = {
  ga4: 72,
  meta: 168,
  snap: 168,
  tiktok: 168,
  openai: 167,
};

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HTTP_TIMEOUT = 408;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_MIN = 500;

export type SendOutcome =
  | {
      readonly kind: "response";
      readonly status: number;
      readonly apiError: string | null;
      /** خطأ الجسم مؤقت (حد معدل أو عطل عند المنصة): يُعاد حتى أقصى المحاولات. */
      readonly apiRetryable?: boolean;
    }
  | { readonly kind: "network"; readonly reason: "timeout" | "network" };

export type DeliveryDecision =
  | { readonly kind: "sent" }
  | { readonly kind: "retry"; readonly at: Date; readonly reason: string }
  | { readonly kind: "dead"; readonly reason: string };

function isRetryable(outcome: SendOutcome): boolean {
  if (outcome.kind === "network") {
    return true;
  }
  const { status } = outcome;
  if (outcome.apiError !== null) {
    return outcome.apiRetryable === true;
  }
  return status === HTTP_TIMEOUT || status === HTTP_TOO_MANY || status >= HTTP_SERVER_MIN;
}

function reasonOf(outcome: SendOutcome): string {
  if (outcome.kind === "network") {
    return outcome.reason;
  }
  return outcome.apiError ?? `http_${String(outcome.status)}`;
}

function isSuccess(outcome: SendOutcome): boolean {
  return (
    outcome.kind === "response" &&
    outcome.status >= HTTP_OK_MIN &&
    outcome.status <= HTTP_OK_MAX &&
    outcome.apiError === null
  );
}

/** `attempts` يشمل المحاولة التي انتهت للتو. */
export function decideDelivery(
  outcome: SendOutcome,
  attempts: number,
  now: Date,
): DeliveryDecision {
  if (isSuccess(outcome)) {
    return { kind: "sent" };
  }
  const reason = reasonOf(outcome);
  if (!isRetryable(outcome) || attempts >= MAX_DELIVERY_ATTEMPTS) {
    return { kind: "dead", reason };
  }
  const minutes = BACKOFF_MINUTES[attempts] ?? 1;
  return { kind: "retry", at: new Date(now.getTime() + minutes * MS_PER_MINUTE), reason };
}

/** الحدث أقدم مما تقبله المنصة: لا يُرسل أصلًا (ميتا ترفض الدفعة كلها بحدث أقدم من 7 أيام). */
export function isTooOld(provider: ServerProvider, eventTime: Date, now: Date): boolean {
  return now.getTime() - eventTime.getTime() > MAX_AGE_HOURS[provider] * MS_PER_HOUR;
}
