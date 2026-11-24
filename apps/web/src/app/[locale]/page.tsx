import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, LOCALES, localizedPath, type Locale } from "@/i18n/locales";

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

/** صفحة الأساس للمرحلة 1: تثبت أن اللغة والاتجاه والتوجيه تعمل. تُستبدل بالرئيسية في المرحلة 2. */
export default async function FoundationPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const dictionary = getDictionary(locale);
  const alternate = otherLocale(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-bold">{dictionary.foundation.title}</h1>
      <p className="text-lg text-neutral-700">{dictionary.foundation.lead}</p>
      <p>
        <Link
          href={localizedPath(alternate)}
          hrefLang={alternate}
          lang={alternate}
          className="underline underline-offset-4"
        >
          {dictionary.foundation.switchLanguage}
        </Link>
      </p>
    </main>
  );
}
