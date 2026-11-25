import { DomainError } from "../../errors";
import type { Currency } from "../../money";
import { err, ok, type Result } from "../../result";
import type { MembershipStartRule } from "../lifecycle";
import type { BasisPoints, PurchasableKind } from "../pricing";

/**
 * سياسة البيع للنادي كما في صف `clubs`. القيمة null تعني أن المالك لم يحسمها بعد،
 * فتمنع العملية ولا يُفترض لها بديل في الكود.
 */
export interface CommercePolicy {
  readonly vatRate: BasisPoints;
  readonly currency: Currency;
  readonly timeZone: string;
  readonly orderPaymentWindowMinutes: number | null;
  readonly membershipStartRule: MembershipStartRule | null;
}

/** السياسات غير المحسومة التي تمنع إنشاء الطلب، بترتيب فحص ثابت. */
export const UNDECIDED_POLICIES = ["order_payment_window", "membership_start_rule"] as const;

export type UndecidedPolicy = (typeof UNDECIDED_POLICIES)[number];

/** ما تحتاجه السلة بعد التحقق من أن كل سياسة لازمة محسومة. */
export interface DecidedCheckout {
  readonly paymentWindowMinutes: number;
  /** القاعدة التي تُختم على سطر الاشتراك؛ null للبرنامج الرقمي لأنه لا يحتاجها. */
  readonly membershipStartRule: MembershipStartRule | null;
}

/**
 * السياسات غير المحسومة التي تمنع بيع هذا المنتج. المهلة تلزم كل طلب،
 * وقاعدة البدء تلزم طلبات الاشتراك فقط.
 */
export function checkoutBlockers(
  policy: CommercePolicy,
  primaryKind: PurchasableKind,
): readonly UndecidedPolicy[] {
  const missing: Record<UndecidedPolicy, boolean> = {
    order_payment_window: policy.orderPaymentWindowMinutes === null,
    membership_start_rule: primaryKind === "membership" && policy.membershipStartRule === null,
  };
  return UNDECIDED_POLICIES.filter((name) => missing[name]);
}

/** الخطأ الذي يُرجَع للسياسة الأولى غير المحسومة. القائمة الفارغة استدعاء خاطئ لا خطأ عميل. */
export function blockerError(blockers: readonly UndecidedPolicy[]): DomainError {
  const [first] = blockers;
  if (first === undefined) {
    throw new DomainError("invariant", "policy.no_blockers");
  }
  return new DomainError("conflict", `policy.undecided.${first}`);
}

/** يرجع السياسات المحسومة اللازمة لهذا المنتج، أو خطأ أول سياسة غير محسومة. */
export function decidedCheckout(
  policy: CommercePolicy,
  primaryKind: PurchasableKind,
): Result<DecidedCheckout, DomainError> {
  const blockers = checkoutBlockers(policy, primaryKind);
  const window = policy.orderPaymentWindowMinutes;
  if (blockers.length > 0 || window === null) {
    return err(blockerError(blockers));
  }
  return ok({
    paymentWindowMinutes: window,
    membershipStartRule: primaryKind === "membership" ? policy.membershipStartRule : null,
  });
}
