import "server-only";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, localizedPath, type Locale } from "@/i18n/locales";
import { getEnv } from "./env";

interface PageMetadataInput {
  readonly locale: Locale;
  /** مسار الصفحة بلا بادئة لغة. */
  readonly path: string;
  readonly title: string;
  readonly description: string;
}

/** عنوان ووصف ورابط معتمد وبدائل لغوية لكل صفحة: رابط واحد لكل لغة، والعربية هي الافتراضية. */
export function pageMetadata({ locale, path, title, description }: PageMetadataInput): Metadata {
  const origin = getEnv().SITE_URL;
  const urlFor = (target: Locale) => `${origin}${localizedPath(target, path)}`;
  const languages = Object.fromEntries(LOCALES.map((target) => [target, urlFor(target)]));
  return {
    title,
    description,
    alternates: {
      canonical: urlFor(locale),
      languages: { ...languages, "x-default": urlFor(DEFAULT_LOCALE) },
    },
    openGraph: { title, description, url: urlFor(locale), locale, type: "website" },
  };
}
