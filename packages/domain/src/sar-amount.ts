import { MAX_AMOUNT_MINOR } from "./commerce/pricing/limits";
import { toAsciiDigits } from "./digits";
import { DomainError } from "./errors";
import { err, ok, type Result } from "./result";

const FIELD = "amount";
const MINOR_PER_MAJOR = 100;
const MINOR_DIGITS = 2;
/** جزء صحيح وجزء عشري على الأكثر. */
const MAX_PARTS = 2;
/** أقصى طول يُقبل قبل أي معالجة: يرفض الإدخال الضخم بلا تحليل. */
const MAX_INPUT_LENGTH = 32;
/** الفاصلة العشرية العربية «٫» وفاصلة الآلاف العربية «٬». */
const ARABIC_DECIMAL = /٫/g;
const ARABIC_THOUSANDS = /٬/g;
/** أرقام متصلة، أو مجموعات آلاف صحيحة («1,499»)؛ الفاصلة في غير موضعها مرفوضة لا مخمَّنة. */
const WHOLE_PART = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;
const DIGITS_ONLY = /^\d+$/;

function invalid(reason: string): Result<never, DomainError> {
  return err(new DomainError("validation", reason, { field: FIELD }));
}

/** علامات الاتجاه غير المرئية تأتي مع النسخ من واتساب وكشوف البنوك. */
function normalise(input: string): string {
  return toAsciiDigits(input.replace(/\p{Cf}/gu, "").trim())
    .replace(ARABIC_DECIMAL, ".")
    .replace(ARABIC_THOUSANDS, ",");
}

function fractionMinor(fraction: string | undefined): Result<number, DomainError> {
  if (fraction === undefined) {
    return ok(0);
  }
  if (!DIGITS_ONLY.test(fraction)) {
    return invalid("amount.invalid_format");
  }
  if (fraction.length > MINOR_DIGITS) {
    return invalid("amount.too_many_decimals");
  }
  return ok(Number(fraction.padEnd(MINOR_DIGITS, "0")));
}

/**
 * مبلغ بالريال كما يكتبه الموظف ← هللات صحيحة. يقبل أرقامًا لاتينية أو عربية، وفاصلة آلاف في موضعها،
 * وخانتين عشريتين على الأكثر («1499»، «1,499.50»، «١٤٩٩٫٥»). كل ما عدا ذلك مرفوض: لا تقريب، ولا تخمين
 * لمعنى فاصلة («1,5» ليست واحدًا ونصفًا)، ولا سالب، ولا رمز عملة. الحساب بالأعداد الصحيحة وحدها.
 */
export function parseSarAmount(input: string): Result<number, DomainError> {
  if (input.length > MAX_INPUT_LENGTH) {
    return invalid("amount.invalid_format");
  }
  const text = normalise(input);
  if (/^[-−]/.test(text)) {
    return invalid("amount.negative");
  }
  const parts = text.split(".");
  const [whole, fraction] = parts;
  if (whole === undefined || parts.length > MAX_PARTS || !WHOLE_PART.test(whole)) {
    return invalid("amount.invalid_format");
  }
  const minor = fractionMinor(fraction);
  if (!minor.ok) {
    return minor;
  }
  // BigInt: نص من مئات الأرقام لا يفقد دقة قبل فحص الحد
  const total = BigInt(whole.replaceAll(",", "")) * BigInt(MINOR_PER_MAJOR) + BigInt(minor.value);
  if (total > BigInt(MAX_AMOUNT_MINOR)) {
    return invalid("amount.too_large");
  }
  return ok(Number(total));
}
