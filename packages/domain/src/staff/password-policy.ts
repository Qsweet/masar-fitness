import { DomainError } from "../errors";
import { err, ok, type Result } from "../result";
import { COMMON_PASSWORDS } from "./common-passwords";

/**
 * سياسة كلمة المرور (NIST SP 800-63B): طول فقط بلا قواعد تركيب ولا انتهاء دوري، ورفض الشائع
 * وما يحوي بريد صاحبها أو اسم النادي.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** أقصر جزء من البريد أو اسم النادي يُبحث عنه داخل الكلمة؛ أقصر منه يرفض كلمات بريئة. */
const MIN_IDENTITY_FRAGMENT = 4;
/** أطول وحدة تُعدّ تكرارًا («abcabcabcabc»). */
const MAX_REPEAT_UNIT = 4;

export interface PasswordContext {
  readonly password: string;
  readonly email: string;
  /** أسماء النادي بلغاته وصيغه. */
  readonly forbiddenWords: readonly string[];
}

function fold(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** وحدة قصيرة مكررة حتى آخر الكلمة. */
function isRepeatedUnit(text: string): boolean {
  for (let size = 1; size <= MAX_REPEAT_UNIT; size += 1) {
    const unit = text.slice(0, size);
    if (unit.repeat(Math.ceil(text.length / size)).startsWith(text)) {
      return true;
    }
  }
  return false;
}

/** محارف متتالية صعودًا أو نزولًا بفرق واحد («abcdefghijkl»). تسلسل الأرقام الملتف في القائمة. */
function isSequence(text: string): boolean {
  const codes = Array.from(text, (char) => char.codePointAt(0) ?? 0);
  const step = (codes[1] ?? 0) - (codes[0] ?? 0);
  if (Math.abs(step) !== 1) {
    return false;
  }
  return codes.every((code, index) => index === 0 || code - (codes[index - 1] ?? 0) === step);
}

function identityFragments(context: PasswordContext): string[] {
  const email = fold(context.email);
  const localPart = email.split("@")[0] ?? "";
  return [email, localPart, ...context.forbiddenWords.map(fold)].filter(
    (fragment) => fragment.length >= MIN_IDENTITY_FRAGMENT,
  );
}

function rejection(reason: string): Result<never, DomainError> {
  return err(new DomainError("validation", reason, { field: "password" }));
}

/**
 * يفحص كلمة مرور جديدة ويرجعها موحّدة (NFKC) لتُجزَّأ بالصيغة نفسها عند كل دخول. الطول بالمحارف
 * (نقاط الترميز) لا بوحدات UTF-16، فالحرف العربي والرمز التعبيري حرف واحد.
 */
export function checkPasswordPolicy(context: PasswordContext): Result<string, DomainError> {
  const password = context.password.normalize("NFKC");
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH) {
    return rejection("staff.password_too_short");
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return rejection("staff.password_too_long");
  }
  const folded = fold(password);
  if (COMMON_PASSWORDS.has(folded) || isRepeatedUnit(folded) || isSequence(folded)) {
    return rejection("staff.password_common");
  }
  if (identityFragments(context).some((fragment) => folded.includes(fragment))) {
    return rejection("staff.password_contains_identity");
  }
  return ok(password);
}

/** الصيغة التي تُجزَّأ وتُقارَن عند الدخول: التوحيد نفسه بلا فحص سياسة. */
export function normalizePassword(password: string): string {
  return password.normalize("NFKC");
}
