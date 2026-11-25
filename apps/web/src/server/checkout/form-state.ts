import "server-only";
import { randomUUID } from "node:crypto";
import { money, type DomainError, type Money } from "@masar/domain";
import { moneyParts, type MoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import type { CheckoutField, CheckoutFieldErrors } from "./form-schema";

export type CheckoutNotice = "price_changed" | "data_changed";

/**
 * حالة نموذج البيانات بين المحاولات (useActionState). الأخطاء مفاتيح أسباب تُترجم في العرض،
 * والإجمالي منسَّق هنا على الخادم فلا يُحسب في المتصفح.
 */
export interface CheckoutFormState {
  readonly values: { readonly name: string; readonly mobile: string };
  readonly errors: CheckoutFieldErrors;
  readonly idempotencyKey: string;
  readonly quotedTotalMinor: number;
  readonly total: MoneyParts;
  readonly notice: CheckoutNotice | null;
}

/** الحالة الأولى عند عرض الصفحة: مفتاح جديد لهذه النية والإجمالي المعروض. */
export function initialCheckoutState(total: Money, locale: Locale): CheckoutFormState {
  return {
    values: { name: "", mobile: "" },
    errors: {},
    idempotencyKey: randomUUID(),
    quotedTotalMinor: total.amountMinor,
    total: moneyParts(total, locale),
    notice: null,
  };
}

/** أخطاء المجال على حقولها؛ ما لا حقل ظاهر له يذهب إلى النموذج. */
export function domainFieldErrors(errors: readonly DomainError[]): CheckoutFieldErrors {
  const result: CheckoutFieldErrors = {};
  for (const error of errors) {
    const field: CheckoutField =
      error.field === "name" || error.field === "mobile" || error.field === "coupon"
        ? error.field
        : "form";
    result[field] ??= error.reason;
  }
  return result;
}

/** الإجمالي الجديد من سبب `cart.price_changed` كما يكتبه createOrder. */
function changedTotal(error: DomainError): number | undefined {
  const { cause } = error;
  if (typeof cause === "object" && cause !== null && "totalMinor" in cause) {
    return typeof cause.totalMinor === "number" ? cause.totalMinor : undefined;
  }
  return undefined;
}

/**
 * حالة النموذج بعد رفض الإنشاء. تغيّر السعر يأخذ الإجمالي الجديد ومفتاحًا جديدًا، فالتأكيد الثاني
 * يطابق ولا تنشأ حلقة؛ وتعارض المفتاح مفتاح جديد. غيرهما خطأ على حقله والمفتاح نفسه.
 */
export function stateAfterRejection(
  state: CheckoutFormState,
  error: DomainError,
  locale: Locale,
): CheckoutFormState {
  const total = error.reason === "cart.price_changed" ? changedTotal(error) : undefined;
  if (total !== undefined) {
    return {
      ...state,
      errors: {},
      idempotencyKey: randomUUID(),
      quotedTotalMinor: total,
      // العملة الوحيدة المدعومة (CURRENCIES)؛ السعر نفسه من القاعدة
      total: moneyParts(money(total), locale),
      notice: "price_changed",
    };
  }
  if (error.reason === "order.idempotency_key_reused") {
    return { ...state, errors: {}, idempotencyKey: randomUUID(), notice: "data_changed" };
  }
  return { ...state, errors: domainFieldErrors([error]), notice: null };
}
