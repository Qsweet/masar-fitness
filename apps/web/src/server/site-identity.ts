import "server-only";
import logo from "@/assets/brand/logo.png";
import { PHOTOS } from "@/config/photos";
import type { Locale } from "@/i18n/locales";
import { getEnv } from "./env";
import type { SiteIdentity } from "./structured-data";

/**
 * هوية الموقع للبيانات المنظَّمة: الأصل من الإعداد، والاسم من المحتوى المحلول (`getSiteContent`)
 * فيطابق ما في الصفحة، والشعار برابط مطلق.
 */
export function siteIdentity(locale: Locale, clubName: string): SiteIdentity {
  const origin = getEnv().SITE_URL;
  return {
    origin,
    locale,
    clubName,
    logoUrl: `${origin}${logo.src}`,
  };
}

/** روابط مطلقة لصور النادي الحقيقية (الظاهرة في الرئيسية). */
export function clubPhotoUrls(): string[] {
  const origin = getEnv().SITE_URL;
  return Object.values(PHOTOS).map((photo) => `${origin}${photo.src}`);
}
