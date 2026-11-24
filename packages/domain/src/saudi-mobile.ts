import { DomainError } from "./errors";
import { err, ok, type Result } from "./result";

/** رقم جوال سعودي بصيغة E.164 (‎+9665XXXXXXXX). يُنشأ عبر `parseSaudiMobile` فقط. */
export type SaudiMobile = string & { readonly __brand: "SaudiMobile" };

const COUNTRY_CODE = "966";
/** الرقم الوطني بلا الصفر البادئ: 9 أرقام تبدأ بـ5. */
const NATIONAL_PATTERN = /^5\d{8}$/;
const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;
const DIGIT_COUNT = 10;
const ASCII_ZERO = 0x30;

/** يحوّل الأرقام العربية (٠-٩) والفارسية (۰-۹) إلى أرقام لاتينية. */
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
