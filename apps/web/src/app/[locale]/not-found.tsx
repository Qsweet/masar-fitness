import Link from "next/link";
import { locale as currentLocale } from "next/root-params";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@/i18n/locales";

export default async function NotFound() {
  const raw = await currentLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-bold">{dictionary.notFound.title}</h1>
      <p className="text-lg text-neutral-700">{dictionary.notFound.lead}</p>
      <p>
        <Link href={localizedPath(locale)} className="underline underline-offset-4">
          {dictionary.notFound.home}
        </Link>
      </p>
    </main>
  );
}
