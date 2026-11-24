/** أصناف أخطاء العمل. طبقة الويب تحوّل كل صنف إلى حالة HTTP واحدة. */
export const DOMAIN_ERROR_CODES = [
  "validation",
  "not_found",
  "conflict",
  "unauthenticated",
  "forbidden",
  "invariant",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export interface DomainErrorOptions {
  /** الحقل المسبِّب، ليُعرض الخطأ بجانبه في النموذج. */
  readonly field?: string;
  readonly cause?: unknown;
}

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  /** مفتاح ثابت تُترجَم منه الرسالة للعميل؛ لا يُعرض `message` الخام للمستخدم. */
  readonly reason: string;
  readonly field: string | undefined;

  constructor(code: DomainErrorCode, reason: string, options: DomainErrorOptions = {}) {
    super(`${code}: ${reason}`, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "DomainError";
    this.code = code;
    this.reason = reason;
    this.field = options.field;
  }
}
