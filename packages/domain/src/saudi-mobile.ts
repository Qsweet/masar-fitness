import { toAsciiDigits } from "./digits";
import { DomainError } from "./errors";
import { err, ok, type Result } from "./result";

/** رقم جوال سعودي بصيغة E.164 (‎+9665XXXXXXXX). يُنشأ عبر `parseSaudiMobile` فقط. */
export type SaudiMobile = string & { readonly __brand: "SaudiMobile" };

const COUNTRY_CODE = "966";
/** الرقم الوطني بلا الصفر البادئ: 9 أرقام تبدأ بـ5. */
const NATIONAL_PATTERN = /^5\d{8}$/;
/** يزيل بادئة الدولة ثم الصفر المحلي (يُكتب أحيانًا ‎+966 05…) ويرجع الرقم الوطني. */
function toNational(digits: string): string {
  const withoutCountry =
    [`00${COUNTRY_CODE}`, COUNTRY_CODE]
      .filter((prefix) => digits.startsWith(prefix))
      .map((prefix) => digits.slice(prefix.length))[0] ?? digits;
  return withoutCountry.startsWith("0") ? withoutCountry.slice(1) : withoutCountry;
}

/**
 * يقبل ما يكتبه العميل فعلًا: ‎05XXXXXXXX، ‎5XXXXXXXX، ‎+9665…، ‎009665…، مع مسافات أو شرطات أو نقاط أو أرقام عربية.
 */
export function parseSaudiMobile(input: string): Result<SaudiMobile, DomainError> {
  // الأرقام المنسوخة من جهات الاتصال وواتساب تحمل علامات اتجاه غير مرئية (‎\p{Cf}‎)
  const ascii = toAsciiDigits(input.replace(/\p{Cf}/gu, "").trim());
  if (!/^\+?[\d\s\-.()]+$/.test(ascii)) {
    return err(new DomainError("validation", "mobile.invalid_characters", { field: "mobile" }));
  }
  const digits = ascii.replace(/\D/g, "");
  // علامة + تعني صيغة دولية: يجب أن يتبعها رمز الدولة مباشرة
  if (ascii.startsWith("+") && !digits.startsWith(COUNTRY_CODE)) {
    return err(new DomainError("validation", "mobile.not_saudi_mobile", { field: "mobile" }));
  }
  const national = toNational(digits);
  if (!NATIONAL_PATTERN.test(national)) {
    return err(new DomainError("validation", "mobile.not_saudi_mobile", { field: "mobile" }));
  }
  return ok(`+${COUNTRY_CODE}${national}` as SaudiMobile);
}

/** «+966» تبقى ظاهرة: لا تكشف شيئًا لأن كل الجوالات المقبولة سعودية. */
const COUNTRY_PREFIX_LENGTH = COUNTRY_CODE.length + 1;
const NATIONAL_LENGTH = 9;
const MASK = "•";

function assertVisibleDigits(visibleDigits: number): void {
  if (!Number.isInteger(visibleDigits) || visibleDigits < 0 || visibleDigits >= NATIONAL_LENGTH) {
    throw new DomainError("invariant", "mobile.mask_visible_digits");
  }
}

/**
 * آخر `count` رقمًا من جوال مخزَّن، للتعرّف لا للاتصال. المصدر الوحيد لقصّ الجوال: القوائم تعرض
 * ما يخرج من هنا فقط.
 */
export function lastMobileDigits(e164: string, count: number): string {
  assertVisibleDigits(count);
  return count === 0 ? "" : e164.slice(-count);
}

/**
 * جوال مقنَّع: بادئة الدولة ثم نقاط ثم آخر `visibleDigits` رقمًا («+966•••••4567»). الصفحة العامة
 * تُظهر رقمين، واللوحة أربعة. قيمة ليست بشكل E.164 السعودي تُقنَّع كلها: لا يُعرض ما لا نعرف شكله.
 */
export function maskSaudiMobile(e164: string, visibleDigits: number): string {
  assertVisibleDigits(visibleDigits);
  if (!/^\+9665\d{8}$/.test(e164)) {
    return MASK.repeat(NATIONAL_LENGTH);
  }
  const hidden = NATIONAL_LENGTH - visibleDigits;
  return (
    e164.slice(0, COUNTRY_PREFIX_LENGTH) +
    MASK.repeat(hidden) +
    lastMobileDigits(e164, visibleDigits)
  );
}
