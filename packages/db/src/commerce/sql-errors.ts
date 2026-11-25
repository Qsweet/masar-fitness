/**
 * قراءة أخطاء PostgreSQL كما يحوّلها محوّل Prisma 7 (`@prisma/adapter-pg`):
 * - استعلام Prisma أو خام: `PrismaClientKnownRequestError` و`meta.driverAdapterError.cause`.
 * - خطأ عند COMMIT (trigger مؤجَّل): `DriverAdapterError` نفسه و`cause`.
 * السبب يحمل `constraint.index` للفرادة والمفتاح الأجنبي، أو رسالة PostgreSQL الأصلية لغيرهما.
 */
import { DomainError } from "@masar/domain";

type Fields = Readonly<Record<string, unknown>>;

const UNIQUE_VIOLATION = "23505";
const UNIQUE_KIND = "UniqueConstraintViolation";
/** أقصى عمق نتتبعه في سلسلة `cause`؛ أعمق من ذلك ليس خطأ محوّل. */
const MAX_CAUSE_DEPTH = 4;
/** «violates check constraint "name"» وأخواتها. */
const NAMED_CONSTRAINT = /constraint "([^"]+)"/;
/** رسائل triggers الثابتة اسم واحد بحروف صغيرة (مثل `promotion_redemption_limit`). */
const FIXED_TRIGGER_MESSAGE = /^[a-z][a-z0-9_]*$/;

/** أسماء القيود التي تعرفها طبقة البيع بأسمائها الثابتة. */
export const COMMERCE_CONSTRAINTS = {
  orderIdempotencyKey: "orders_idempotency_key_key",
  orderPaymentReference: "orders_paid_provider_paid_provider_payment_id_key",
  assessmentIdempotencyKey: "assessment_requests_idempotency_key_key",
  promotionRedemptionLimit: "promotion_redemption_limit",
  promotionCustomerLimit: "promotion_customer_limit",
} as const;

/** سبب داخلي: خطأ فرادة على مفتاح الطلب، فيُعاد مسار القراءة بدل إظهار خطأ. */
export const IDEMPOTENCY_RETRY = "order.idempotency_retry";

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null;
}

function text(fields: Fields, key: string): string | undefined {
  const value = fields[key];
  return typeof value === "string" ? value : undefined;
}

/** سبب خطأ المحوّل (الحقول الخام من PostgreSQL)، أينما كان في السلسلة. */
function adapterCause(error: unknown, depth = 0): Fields | undefined {
  if (!isFields(error) || depth > MAX_CAUSE_DEPTH) {
    return undefined;
  }
  const meta = error.meta;
  if (isFields(meta) && isFields(meta.driverAdapterError)) {
    const cause = meta.driverAdapterError.cause;
    return isFields(cause) ? cause : undefined;
  }
  if (text(error, "name") === "DriverAdapterError" && isFields(error.cause)) {
    return error.cause;
  }
  return adapterCause(error.cause, depth + 1);
}

function messageConstraint(cause: Fields): string | undefined {
  const message = text(cause, "originalMessage") ?? text(cause, "message");
  if (message === undefined) {
    return undefined;
  }
  const named = NAMED_CONSTRAINT.exec(message)?.[1];
  if (named !== undefined) {
    return named;
  }
  return FIXED_TRIGGER_MESSAGE.test(message) ? message : undefined;
}

/** اسم القيد (أو رسالة trigger الثابتة) الذي رفض الجملة، أو undefined إن لم يكن خطأ قيد. */
export function constraintName(error: unknown): string | undefined {
  const cause = adapterCause(error);
  if (cause === undefined) {
    return undefined;
  }
  const constraint = cause.constraint;
  const index = isFields(constraint) ? text(constraint, "index") : undefined;
  return index ?? messageConstraint(cause);
}

/** هل الخطأ خرق فرادة على هذا القيد بالاسم؟ */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = adapterCause(error);
  if (cause === undefined) {
    return false;
  }
  const isUnique =
    text(cause, "kind") === UNIQUE_KIND || text(cause, "originalCode") === UNIQUE_VIOLATION;
  return isUnique && constraintName(error) === constraint;
}

/** القيد الذي هو سدّ أخير لسباق معروف ⇒ سبب خطأ العمل المقابل. */
const RACE_GUARD_REASONS: ReadonlyMap<string, string> = new Map([
  [COMMERCE_CONSTRAINTS.orderIdempotencyKey, IDEMPOTENCY_RETRY],
  [COMMERCE_CONSTRAINTS.orderPaymentReference, "payment.already_used"],
  [COMMERCE_CONSTRAINTS.promotionRedemptionLimit, "promotion.exhausted"],
  [COMMERCE_CONSTRAINTS.promotionCustomerLimit, "promotion.customer_limit_reached"],
]);

/**
 * يحوّل خرق القيود التي هي سدود أخيرة لسباق معروف إلى خطأ عمل. ما عداها undefined فيبقى عطلًا 500،
 * لأن القيد الذي يرفض كتابة الكود نفسه خلل يجب أن يظهر.
 */
export function mapCommerceDbError(error: unknown): DomainError | undefined {
  const name = constraintName(error);
  const reason = name === undefined ? undefined : RACE_GUARD_REASONS.get(name);
  return reason === undefined ? undefined : new DomainError("conflict", reason, { cause: error });
}
