import { ROUTES } from "@/config/routes";
import { defaultDictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { pageTracking } from "@/server/tracking/page-tracking";
import { ConsentBanner } from "./consent-banner";
import { GoogleStub } from "./google-stub";
import { TagLoader } from "./tag-loader";

const GOOGLE = new Set(["gtm", "ga4", "google_ads"]);

/**
 * جذر القياس في تخطيط الموقع (ADMIN_A5_TRACKING §3): بلا منصة مفعّلة لا يُرسم شيء. الشريط والمحمّل
 * مكوّنا عميل، وشيفرة Google الأساسية في HTML الخادم بالـnonce.
 */
export async function TrackingRoot({ locale }: { readonly locale: Locale }) {
  const tracking = await pageTracking();
  if (tracking === null) {
    return null;
  }
  const copy = defaultDictionary(locale).consent;
  const names = tracking.providers.map((item) => copy.providerNames[item.provider]);
  const hasGoogle = tracking.providers.some((item) => GOOGLE.has(item.provider));
  return (
    <>
      {hasGoogle ? <GoogleStub nonce={tracking.nonce} /> : null}
      <TagLoader providers={tracking.providers} nonce={tracking.nonce} />
      <ConsentBanner
        copy={copy}
        providers={[...new Set(names)]}
        locale={locale}
        privacyHref={localizedPath(locale, ROUTES.privacy)}
        initiallyOpen={tracking.consent === null}
      />
    </>
  );
}
