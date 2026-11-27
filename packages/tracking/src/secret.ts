/**
 * المفتاح الخادمي لكل منصة مشفّرًا في القاعدة (ADMIN_A5_TRACKING §8، القرار 88-4): AES-256-GCM
 * (`sealSecret` القائم) بمفتاح فرعي من `ADMIN_SECRET_KEY` بـHKDF-SHA-256، فمفتاح اللوحة لا يُستعمل
 * لغرضين بالبايتات نفسها، و`club_id:provider` بيانات موثَّقة فلا يُنقل مفتاح من صف إلى آخر.
 */
import { hkdfSync } from "node:crypto";
import { openSecret, sealSecret, SECRET_KEY_BYTES } from "@masar/db";
import type { TrackingProvider } from "@masar/domain";

const HKDF_INFO = "masar:tracking-secret:v1";
const HKDF_SALT = new Uint8Array(0);
const LAST_CHARS = 4;
/** أطول مفتاح يقبله الحقل: رموز المنصات أقصر بكثير (ميتا نحو 200 محرف). */
export const MAX_SECRET_LENGTH = 1024;
const SECRET_SHAPE = /^[\x21-\x7e]{8,1024}$/;

export function deriveTrackingKey(adminKey: Uint8Array): Uint8Array {
  return new Uint8Array(hkdfSync("sha256", adminKey, HKDF_SALT, HKDF_INFO, SECRET_KEY_BYTES));
}

function contextOf(clubId: string, provider: TrackingProvider): string {
  return `tracking:${clubId}:${provider}`;
}

/** مفتاح يلصقه المالك: محارف ASCII ظاهرة بلا مسافة، 8 إلى 1024. غير ذلك يُرفض لا يُشذَّب. */
export function isPlausibleSecret(value: string): boolean {
  return SECRET_SHAPE.test(value);
}

export interface SealedTrackingSecret {
  readonly sealed: string;
  readonly last4: string;
}

export function sealTrackingSecret(
  adminKey: Uint8Array,
  clubId: string,
  provider: TrackingProvider,
  plaintext: string,
): SealedTrackingSecret {
  const sealed = sealSecret(
    deriveTrackingKey(adminKey),
    new TextEncoder().encode(plaintext),
    contextOf(clubId, provider),
  );
  return { sealed, last4: plaintext.slice(-LAST_CHARS) };
}

/** null لأي فشل (مفتاح لوحة دُوِّر، صف آخر، نص معبوث به). */
export function openTrackingSecret(
  adminKey: Uint8Array,
  clubId: string,
  provider: TrackingProvider,
  sealed: string,
): string | null {
  const opened = openSecret(deriveTrackingKey(adminKey), sealed, contextOf(clubId, provider));
  return opened === null ? null : new TextDecoder().decode(opened);
}
