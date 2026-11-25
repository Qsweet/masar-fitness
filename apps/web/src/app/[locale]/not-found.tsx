import { locale as currentLocale } from "next/root-params";
import { PageShell } from "@/components/page-shell";
import { ButtonLink } from "@/components/ui/button-link";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@/i18n/locales";

export default async function NotFound() {
  const raw = await currentLocale();
  const locale = raw !== undefined && isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <PageShell locale={locale} path="/">
      <section className="surface-deep py-24 md:py-32">
        <div className="page-container">
          <h1 className="text-title font-display">{dictionary.notFound.title}</h1>
          <p className="text-muted mt-4 max-w-prose text-lead">{dictionary.notFound.lead}</p>
          <ButtonLink href={localizedPath(locale)} className="mt-10">
            {dictionary.notFound.home}
          </ButtonLink>
        </div>
      </section>
    </PageShell>
  );
}
