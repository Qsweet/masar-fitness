import { locale as currentLocale } from "next/root-params";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { ButtonLink } from "@/components/ui/button-link";
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@/i18n/locales";
import { getSiteContent } from "@/server/content/site-content";

export default async function NotFound() {
  // مع تخطيط جذري ثانٍ (/admin) بلا معامل لغة، نوع المعامل قد يكون غائبًا: الغائب كغير المعروف
  const raw = await currentLocale();
  const locale = raw !== undefined && isLocale(raw) ? raw : DEFAULT_LOCALE;
  const { dictionary } = await getSiteContent(locale);

  return (
    <PageShell locale={locale} path="/">
      <PageIntro title={dictionary.notFound.title} lead={dictionary.notFound.lead} />
      <div className="container section">
        <ButtonLink href={localizedPath(locale)}>{dictionary.notFound.home}</ButtonLink>
      </div>
    </PageShell>
  );
}
