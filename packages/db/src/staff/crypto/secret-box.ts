/**
 * تشفير سر TOTP في القاعدة: AES-256-GCM بمفتاح `ADMIN_SECRET_KEY`، و IV عشوائي لكل تشفير. معرّف
 * الموظف بيانات موثَّقة إضافية (AAD)، فلا يُنقل سر مشفّر من صف موظف إلى آخر.
 * الصيغة: `v1.<iv>.<tag>.<ciphertext>` بـbase64url.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
export const SECRET_KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BOX_PARTS = 4;
const ENCODING = "base64url";

function assertKey(key: Uint8Array): void {
  if (key.length !== SECRET_KEY_BYTES) {
    throw new RangeError("secret_box.invalid_key_length");
  }
}

export function sealSecret(key: Uint8Array, plaintext: Uint8Array, context: string): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString(ENCODING));
  return [VERSION, ...parts].join(".");
}

/** null لأي فشل (مفتاح آخر، سياق آخر، نص معبوث به، صيغة فاسدة): لا تفاصيل تُسرَّب. */
export function openSecret(key: Uint8Array, box: string, context: string): Uint8Array | null {
  assertKey(key);
  const parts = box.split(".");
  const [version, iv = "", tag = "", ciphertext = ""] = parts;
  if (parts.length !== BOX_PARTS || version !== VERSION) {
    return null;
  }
  const ivBytes = Buffer.from(iv, ENCODING);
  const tagBytes = Buffer.from(tag, ENCODING);
  if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) {
    return null;
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, ivBytes, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tagBytes);
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, ENCODING)),
      decipher.final(),
    ]);
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}
