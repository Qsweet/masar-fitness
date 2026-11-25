import { locale as currentLocale } from "next/root-params";
import { PageIntro } from "@/components/page-intro";
import { PageShell } from "@/components/page-shell";
import { ButtonLink } from "@/components/ui/button-link";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@/i18n/locales";

export default async function NotFound() {
  const raw = await currentLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <PageShell locale={locale} path="/">
      <PageIntro title={dictionary.notFound.title} lead={dictionary.notFound.lead} />
      <div className="container section">
        <ButtonLink href={localizedPath(locale)}>{dictionary.notFound.home}</ButtonLink>
      </div>
    </PageShell>
  );
}
