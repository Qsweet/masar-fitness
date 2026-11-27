/**
 * كوكي الإسناد في الوسيط (ADMIN_A5_TRACKING §5.1، القرار 89-4): `masar_attr` (HttpOnly) بأول لمسة
 * وآخرها. لا كوكي بلا منصة مفعّلة. قبل موافقة الإعلانات: معاملات الحملة وصفحة الهبوط وحدهما؛ معرّفات
 * النقر الإعلانية مع الموافقة فقط (أو من رابط الصفحة لحظة الموافقة، `captureClickIdsAction`).
 * بلا `server-only`: يستورده الوسيط.
 */
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  CONSENT_COOKIE,
  parseConsent,
  decodeAttribution,
  encodeAttribution,
  type Attribution,
  mergeAttribution,
  touchFromQuery,
} from "@masar/domain";
import type { NextRequest, NextResponse } from "next/server";

const MS_PER_SECOND = 1000;
/** حد الكوكي كله: لمستان بأطول القيم المسموحة أقل من هذا بكثير. */
const MAX_COOKIE_CHARS = 3800;

function isHttps(): boolean {
  try {
    return new URL(process.env.SITE_URL ?? "").protocol === "https:";
  } catch {
    return false;
  }
}

export const ATTRIBUTION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
} as const;

/** القيمة الجديدة للكوكي، أو null إن تجاوزت الحد (لا كتابة). */
export function attributionValue(value: Attribution): string | null {
  const encoded = encodeAttribution(value);
  return encoded.length > MAX_COOKIE_CHARS ? null : encoded;
}

export function secureCookie(): boolean {
  return isHttps();
}

/** يكتب الكوكي إن وُجدت منصة مفعّلة وحمل الرابط معاملًا مسموحًا؛ غير ذلك لا يمسّ الرد. */
export function captureAttribution(
  request: NextRequest,
  response: NextResponse,
  trackingActive: boolean,
): void {
  if (!trackingActive) {
    return;
  }
  const { searchParams, pathname } = request.nextUrl;
  const ads = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value)?.ads === true;
  const touch = touchFromQuery(
    (name) => searchParams.get(name),
    Math.floor(Date.now() / MS_PER_SECOND),
    {
      clickIds: ads,
      landing: pathname,
    },
  );
  if (touch === null) {
    return;
  }
  const existing = decodeAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value);
  const value = attributionValue(mergeAttribution(existing, touch));
  if (value !== null) {
    response.cookies.set(ATTRIBUTION_COOKIE, value, {
      ...ATTRIBUTION_COOKIE_OPTIONS,
      secure: isHttps(),
    });
  }
}
