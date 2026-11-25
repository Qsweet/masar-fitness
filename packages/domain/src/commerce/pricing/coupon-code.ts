import { DomainError } from "../../errors";
import { err, ok, type Result } from "../../result";

/** رمز كوبون منظَّف: أحرف لاتينية كبيرة وأرقام فقط. يُبنى عبر `parseCouponCode()` فقط. */
export type CouponCode = string & { readonly __brand: "CouponCode" };

const COUPON_PATTERN = /^[A-Z0-9]{3,32}$/;
/** علامات الاتجاه والمحارف غير المرئية (‎\p{Cf}‎) والمسافات بكل أنواعها. */
const INVISIBLE_OR_SPACE = /[\p{Cf}\s]/gu;
const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;
const DIGIT_COUNT = 10;
const ASCII_ZERO = 0x30;

/** يحوّل الأرقام العربية الهندية (٠-٩) والفارسية (۰-۹) إلى أرقام لاتينية. */
function toAsciiDigits(input: string): string {
  let out = "";
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    const zero = [ARABIC_INDIC_ZERO, EASTERN_ARABIC_INDIC_ZERO].find(
      (base) => code >= base && code < base + DIGIT_COUNT,
    );
    out += zero === undefined ? char : String.fromCodePoint(ASCII_ZERO + (code - zero));
  }
  return out;
}

/**
 * ينظّف ما كتبه العميل ثم يتحقق من الصيغة. الحقل الفارغ بعد التنظيف يعني «بلا كوبون».
 * وجود الكوبون وصلاحيته يُفحصان لاحقًا، فهذه الدالة للشكل فقط.
 */
export function parseCouponCode(input: string): Result<CouponCode | null, DomainError> {
  const cleaned = toAsciiDigits(input.replace(INVISIBLE_OR_SPACE, "")).toUpperCase();
  if (cleaned === "") {
    return ok(null);
  }
  if (!COUPON_PATTERN.test(cleaned)) {
    return err(new DomainError("validation", "coupon.invalid_format", { field: "coupon" }));
  }
  return ok(cleaned as CouponCode);
}
