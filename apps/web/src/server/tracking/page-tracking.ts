import "server-only";
import { CONSENT_COOKIE, parseConsent, type Consent } from "@masar/domain";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { requestNonce } from "../nonce";
import { siteTracking, TRACKING_HEADER, type SiteProvider } from "./site-config";

export interface PageTracking {
  readonly providers: readonly SiteProvider[];
  readonly nonce: string | undefined;
  /** الموافقة الصالحة على النص الحالي، أو null (يظهر الشريط). */
  readonly consent: Consent | null;
}

/**
 * القياس في هذه الصفحة: المنصات المفعّلة التي فتحتها CSP لهذا الطلب (ترويسة الوسيط)، فلا يُرسم وسم
 * تحجبه السياسة. null بلا منصة: لا شريط ولا وسم ولا JavaScript إضافي (ADMIN_A5_TRACKING §9).
 */
export const pageTracking = cache(async (): Promise<PageTracking | null> => {
  const allowed = new Set(((await headers()).get(TRACKING_HEADER) ?? "").split(","));
  const providers = (await siteTracking()).providers.filter((item) => allowed.has(item.provider));
  if (providers.length === 0) {
    return null;
  }
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  return { providers, nonce: await requestNonce(), consent };
});
