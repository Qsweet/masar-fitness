/**
 * TOTP (RFC 6238 فوق HOTP RFC 4226): SHA-1، 6 أرقام، 30 ثانية، نافذة ±1. منطق صرف: دالة HMAC تُحقن
 * من الخادم (`node:crypto`)، فلا يدخل كود Node حزمة المتصفح التي تستورد هذا المجال.
 */
export type HmacSha1 = (key: Uint8Array, message: Uint8Array) => Uint8Array;

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** عدد الخطوات المقبولة قبل الحالية وبعدها (انحراف ساعة الهاتف). */
export const TOTP_WINDOW_STEPS = 1;
/** طول السر بالبايت: 160 بت كما يوصي RFC 4226. */
export const TOTP_SECRET_BYTES = 20;

const MS_PER_SECOND = 1000;
const COUNTER_BYTES = 8;
const UINT32_RANGE = 0x1_0000_0000;
const HIGH_WORD_OFFSET = 0;
const LOW_WORD_OFFSET = 4;
const OFFSET_MASK = 0x0f;
const POSITIVE_INT32_MASK = 0x7fff_ffff;
const BYTE_MASK = 0xff;
const BYTE_BITS = 8;
const DECIMAL_BASE = 10;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_BITS = 5;
const BASE32_MASK = 0x1f;

/** رقم الخطوة الزمنية (العدّاد T في RFC 6238). */
export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / MS_PER_SECOND / TOTP_PERIOD_SECONDS);
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(COUNTER_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(HIGH_WORD_OFFSET, Math.floor(counter / UINT32_RANGE));
  view.setUint32(LOW_WORD_OFFSET, counter % UINT32_RANGE);
  return bytes;
}

/** الاقتطاع الديناميكي (RFC 4226 §5.3): 31 بتًا من موضع يحدده آخر نصف بايت. */
function truncate(digest: Uint8Array): number {
  const offset = (digest.at(-1) ?? 0) & OFFSET_MASK;
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  return view.getUint32(offset) & POSITIVE_INT32_MASK;
}

/** رمز HOTP للعدّاد. `digits` يتغير في متجهات الاختبار فقط (8 في RFC 6238). */
export function hotp(
  hmac: HmacSha1,
  key: Uint8Array,
  counter: number,
  digits: number = TOTP_DIGITS,
): string {
  const code = truncate(hmac(key, counterBytes(counter))) % DECIMAL_BASE ** digits;
  return String(code).padStart(digits, "0");
}

/** مقارنة نصين بزمن لا يعتمد على موضع أول اختلاف. */
export function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index % Math.max(right.length, 1));
  }
  return difference === 0;
}

const TOTP_INPUT = /^[0-9]{6}$/;

/** ما كتبه الموظف بلا مسافات؛ null إن لم يكن ستة أرقام. */
export function parseTotpInput(raw: string): string | null {
  const code = raw.replace(/\s+/g, "");
  return TOTP_INPUT.test(code) ? code : null;
}

export interface TotpCheck {
  readonly hmac: HmacSha1;
  readonly key: Uint8Array;
  readonly code: string;
  readonly nowMs: number;
  /** آخر خطوة قُبل رمزها لهذا الحساب؛ رمزها وما قبلها لا يُقبل ثانية. */
  readonly lastStep: number | null;
}

/**
 * الخطوة التي يطابقها الرمز داخل النافذة، أو null. تُفحص كل خطوات النافذة دائمًا (بلا خروج مبكر)،
 * والخطوة المستعملة وما قبلها مرفوضة. المستدعي يحفظ الخطوة المرجَعة ذرّيًا في القاعدة.
 */
export function matchTotpStep(check: TotpCheck): number | null {
  const current = totpStep(check.nowMs);
  let matched: number | null = null;
  for (let delta = -TOTP_WINDOW_STEPS; delta <= TOTP_WINDOW_STEPS; delta += 1) {
    const step = current + delta;
    const equal = constantTimeEqual(hotp(check.hmac, check.key, step), check.code);
    const fresh = check.lastStep === null || step > check.lastStep;
    if (equal && fresh && matched === null) {
      matched = step;
    }
  }
  return matched;
}

/** Base32 (RFC 4648) بلا حشو: صيغة السر التي تقرؤها تطبيقات التحقق. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << BYTE_BITS) | byte;
    bits += BYTE_BITS;
    while (bits >= BASE32_BITS) {
      bits -= BASE32_BITS;
      output += BASE32_ALPHABET.charAt((value >>> bits) & BASE32_MASK);
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((value << (BASE32_BITS - bits)) & BASE32_MASK);
  }
  return output;
}

/** يفك Base32 (يقبل الحروف الصغيرة والمسافات والحشو)؛ null لمحرف خارج الأبجدية. */
export function base32Decode(text: string): Uint8Array | null {
  const clean = text.toUpperCase().replace(/[\s=]+/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      return null;
    }
    value = (value << BASE32_BITS) | index;
    bits += BASE32_BITS;
    if (bits >= BYTE_BITS) {
      bits -= BYTE_BITS;
      bytes.push((value >>> bits) & BYTE_MASK);
      value &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(bytes);
}

export interface OtpauthInput {
  readonly issuer: string;
  readonly account: string;
  readonly secretBase32: string;
}

/** رابط التسجيل الذي يحمله رمز QR (صيغة Key URI التي تقرؤها تطبيقات التحقق). */
export function otpauthUri({ issuer, account, secretBase32 }: OtpauthInput): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = [
    ["secret", secretBase32],
    ["issuer", issuer],
    ["algorithm", "SHA1"],
    ["digits", String(TOTP_DIGITS)],
    ["period", String(TOTP_PERIOD_SECONDS)],
  ].map(([key, value = ""]) => `${key ?? ""}=${encodeURIComponent(value)}`);
  return `otpauth://totp/${label}?${query.join("&")}`;
}
