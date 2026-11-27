"use server";

import {
  addClickIds,
  ATTRIBUTION_COOKIE,
  CONSENT_COOKIE,
  decodeAttribution,
  parseConsent,
  touchFromQuery,
} from "@masar/domain";
import { cookies } from "next/headers";
import { ATTRIBUTION_COOKIE_OPTIONS, attributionValue, secureCookie } from "./attribution-cookie";
import { siteTracking } from "./site-config";

const MS_PER_SECOND = 1000;
const MAX_SEARCH_LENGTH = 4096;

/**
 * لحظة موافقة الإعلانات (القرار 89-4): معرّفات النقر من رابط الصفحة الحالية تُضاف إلى `masar_attr`.
 * الشرطان على الخادم: كوكي الموافقة في هذا الطلب يمنح الإعلانات، ومنصة مفعّلة. إن غادر الزائر صفحة
 * الهبوط قبل الموافقة فالمعرّف لم يعد في الرابط ويُفقد (موثَّق).
 */
export async function captureClickIdsAction(search: string): Promise<void> {
  if (typeof search !== "string" || search.length > MAX_SEARCH_LENGTH) {
    return;
  }
  const jar = await cookies();
  const ads = parseConsent(jar.get(CONSENT_COOKIE)?.value)?.ads === true;
  if (!ads || (await siteTracking()).providers.length === 0) {
    return;
  }
  const params = new URLSearchParams(search);
  const clicks = touchFromQuery(
    (name) => (name.startsWith("utm_") ? null : params.get(name)),
    Math.floor(Date.now() / MS_PER_SECOND),
    {
      clickIds: true,
    },
  );
  if (clicks === null) {
    return;
  }
  const value = attributionValue(
    addClickIds(decodeAttribution(jar.get(ATTRIBUTION_COOKIE)?.value), clicks),
  );
  if (value !== null) {
    jar.set(ATTRIBUTION_COOKIE, value, { ...ATTRIBUTION_COOKIE_OPTIONS, secure: secureCookie() });
  }
}
