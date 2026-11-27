/**
 * كوكي الإسناد في الوسيط (ADMIN_A5_TRACKING §5.1): رابط بمعرّف نقر أو حملة يكتب `masar_attr`
 * (HttpOnly) بأول لمسة وآخرها. ضروري (سجل تجاري داخلي) فلا ينتظر الموافقة، ولا يخرج لمنصة إلا مع
 * موافقة الإعلانات على الطلب. بلا `server-only`: يستورده الوسيط.
 */
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  decodeAttribution,
  encodeAttribution,
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

/** يكتب الكوكي إن حمل الرابط معاملًا صالحًا؛ غير ذلك لا يمسّ الرد. */
export function captureAttribution(request: NextRequest, response: NextResponse): void {
  const { searchParams } = request.nextUrl;
  const touch = touchFromQuery(
    (name) => searchParams.get(name),
    Math.floor(Date.now() / MS_PER_SECOND),
  );
  if (touch === null) {
    return;
  }
  const existing = decodeAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value);
  const value = encodeAttribution(mergeAttribution(existing, touch));
  if (value.length > MAX_COOKIE_CHARS) {
    return;
  }
  response.cookies.set(ATTRIBUTION_COOKIE, value, {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
  });
}
