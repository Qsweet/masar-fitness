import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/brand/logo.png";
import { ButtonLink } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { LOCALES, localizedPath, type Locale } from "@/i18n/locales";

interface SiteHeaderProps {
  readonly locale: Locale;
  /** مسار الصفحة الحالية بلا بادئة لغة، ليقود تبديل اللغة إلى الصفحة نفسها. */
  readonly path: string;
  readonly dictionary: Dictionary;
}

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

export function SiteHeader({ locale, path, dictionary }: SiteHeaderProps) {
  const alternate = otherLocale(locale);
  return (
    <header className="surface-asphalt rule border-b">
      <div className="page-container flex min-h-18 items-center justify-between gap-4 py-2">
        <Link href={localizedPath(locale)} className="flex items-center gap-3">
          <Image
            src={logo}
            alt={dictionary.club.logoAlt}
            priority
            sizes="56px"
            className="h-14 w-auto"
          />
          <span className="hidden text-heading font-display sm:inline">
            {dictionary.club.shortName}
          </span>
        </Link>
        <nav aria-label={dictionary.nav.main}>
          <ul className="flex items-center gap-4 md:gap-8">
            <li className="hidden md:block">
              <Link
                href={`${localizedPath(locale)}#location`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {dictionary.nav.location}
              </Link>
            </li>
            <li>
              <Link
                href={localizedPath(alternate, path)}
                hrefLang={alternate}
                lang={alternate}
                className="inline-flex min-h-12 items-center font-medium underline-offset-4 hover:underline"
              >
                {dictionary.nav.switchLanguage}
              </Link>
            </li>
            <li>
              <ButtonLink href={localizedPath(locale, "/memberships")}>
                {dictionary.nav.join}
              </ButtonLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
