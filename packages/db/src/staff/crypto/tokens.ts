/** رموز الجلسات والاسترجاع وسر TOTP: عشوائية من `node:crypto`، وتُخزَّن مجزأة SHA-256. */
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { TOTP_SECRET_BYTES, type HmacSha1 } from "@masar/domain";

const SESSION_TOKEN_BYTES = 32;
export const RECOVERY_CODE_COUNT = 10;
/** 16 محرفًا من أبجدية 32 = 80 بتًا، فتجزئة SHA-256 بلا ملح كافية لرمز عشوائي بهذا الطول. */
const RECOVERY_CODE_LENGTH = 16;
const RECOVERY_GROUP_LENGTH = 4;
/** بلا 0 و1 وI وO: لا لبس عند النسخ باليد. */
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface IssuedToken {
  /** يذهب إلى الكوكي ولا يُحفظ. */
  readonly token: string;
  /** يُحفظ في القاعدة. */
  readonly tokenHash: string;
}

export function issueSessionToken(): IssuedToken {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: sha256Hex(token) };
}

/** تجزئة رمز الكوكي للبحث عنه؛ null إن لم يكن بشكل رمز أصدرناه (لا استعلام لقيمة عشوائية). */
export function sessionTokenHash(token: string): string | null {
  return SESSION_TOKEN_SHAPE.test(token) ? sha256Hex(token) : null;
}

function recoveryCode(): string {
  let code = "";
  for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
    if (index > 0 && index % RECOVERY_GROUP_LENGTH === 0) {
      code += "-";
    }
    code += RECOVERY_ALPHABET.charAt(randomInt(RECOVERY_ALPHABET.length));
  }
  return code;
}

/** يوحّد ما كتبه الموظف (حروف صغيرة، مسافات، شرطات) إلى الصيغة التي جُزِّئ بها الرمز. */
export function normalizeRecoveryCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[\s-]+/g, "");
  const valid =
    compact.length === RECOVERY_CODE_LENGTH &&
    Array.from(compact).every((char) => RECOVERY_ALPHABET.includes(char));
  return valid ? compact : null;
}

export function recoveryCodeHash(normalized: string): string {
  return sha256Hex(normalized);
}

export interface IssuedRecoveryCodes {
  /** تُعرض للموظف مرة واحدة. */
  readonly codes: readonly string[];
  readonly hashes: readonly string[];
}

export function issueRecoveryCodes(): IssuedRecoveryCodes {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, recoveryCode);
  const hashes = codes.map((code) => recoveryCodeHash(code.replaceAll("-", "")));
  return { codes, hashes };
}

const TEMPORARY_PASSWORD_LENGTH = 20;
const TEMPORARY_GROUP_LENGTH = 5;

/**
 * كلمة مرور مؤقتة لموظف جديد أو بعد إعادة الضبط: 20 محرفًا عشوائيًا (100 بت) في مجموعات، تُعرض
 * للمالك مرة واحدة ويغيّرها الموظف عند أول دخول.
 */
export function issueTemporaryPassword(): string {
  const chars = Array.from({ length: TEMPORARY_PASSWORD_LENGTH }, () =>
    RECOVERY_ALPHABET.charAt(randomInt(RECOVERY_ALPHABET.length)),
  );
  const groups: string[] = [];
  for (let start = 0; start < chars.length; start += TEMPORARY_GROUP_LENGTH) {
    groups.push(chars.slice(start, start + TEMPORARY_GROUP_LENGTH).join(""));
  }
  return groups.join("-");
}

export function newTotpSecret(): Uint8Array {
  return new Uint8Array(randomBytes(TOTP_SECRET_BYTES));
}

/** HMAC-SHA1 لخوارزمية TOTP في المجال (تُحقن فيها). */
export const hmacSha1: HmacSha1 = (key, message) =>
  new Uint8Array(createHmac("sha1", key).update(message).digest());
