import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/brand/logo.png";
import type { Dictionary } from "@/i18n/dictionaries";
import { LOCALES, localizedPath, type Locale } from "@/i18n/locales";

interface SiteHeaderProps {
  readonly locale: Locale;
  /** مسار الصفحة الحالية بلا بادئة لغة، ليقود تبديل اللغة إلى الصفحة نفسها. */
  readonly path: string;
  readonly dictionary: Dictionary;
}

const NAV_LINK = "inline-flex min-h-12 items-center font-medium underline-offset-4 hover:underline";

function otherLocale(locale: Locale): Locale {
  return LOCALES.find((candidate) => candidate !== locale) ?? locale;
}

/** شريط الماء العميق: الشعار على خلفيته الداكنة كما صُمّم، وتنقل من ثلاثة روابط نصية بلا قائمة مخفية. */
export function SiteHeader({ locale, path, dictionary }: SiteHeaderProps) {
  const alternate = otherLocale(locale);
  return (
    <header className="surface-deep">
      <div className="page-container flex min-h-18 items-center justify-between gap-4 py-2">
        <Link href={localizedPath(locale)} className="flex items-center gap-3">
          <Image
            src={logo}
            alt={dictionary.club.logoAlt}
            priority
            sizes="60px"
            className="h-15 w-auto"
          />
          <span className="hidden text-heading font-medium sm:inline">
            {dictionary.club.shortName}
          </span>
        </Link>
        <nav aria-label={dictionary.nav.main}>
          <ul className="flex items-center gap-5 md:gap-8">
            <li>
              <Link href={localizedPath(locale, "/memberships")} className={NAV_LINK}>
                {dictionary.nav.memberships}
              </Link>
            </li>
            <li className="hidden sm:block">
              <Link href={`${localizedPath(locale)}#location`} className={NAV_LINK}>
                {dictionary.nav.location}
              </Link>
            </li>
            <li>
              <Link
                href={localizedPath(alternate, path)}
                hrefLang={alternate}
                lang={alternate}
                className={NAV_LINK}
              >
                {dictionary.nav.switchLanguage}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
