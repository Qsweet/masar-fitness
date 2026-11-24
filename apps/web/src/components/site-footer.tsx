import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/brand/logo.png";
import { CLUB_CONTACT, whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";

interface SiteFooterProps {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

const LINK = "underline-offset-4 hover:underline";

export function SiteFooter({ locale, dictionary }: SiteFooterProps) {
  return (
    <footer className="surface-asphalt surface-asphalt-deep">
      <div className="page-container grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image src={logo} alt="" sizes="112px" className="h-28 w-auto" />
          <p className="text-muted mt-4 max-w-prose">{CLUB_CONTACT.address[locale]}</p>
        </div>
        <nav aria-label={dictionary.footer.pages} className="md:col-span-3">
          <h2 className="text-subtle text-small font-medium">{dictionary.footer.pages}</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href={localizedPath(locale)} className={LINK}>
                {dictionary.nav.home}
              </Link>
            </li>
            <li>
              <Link href={localizedPath(locale, "/memberships")} className={LINK}>
                {dictionary.nav.memberships}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="md:col-span-4">
          <h2 className="text-subtle text-small font-medium">{dictionary.footer.contact}</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <a href={`tel:${CLUB_CONTACT.phoneE164}`} className={LINK}>
                <bdi>{CLUB_CONTACT.phoneDisplay}</bdi>
              </a>
            </li>
            <li>
              <a
                href={whatsappUrl(dictionary.location.whatsappMessage)}
                rel="noopener noreferrer"
                className={LINK}
              >
                {dictionary.location.whatsapp}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="rule border-t">
        <p className="page-container text-subtle py-5 text-small">
          © <bdi>{new Date().getFullYear()}</bdi> {dictionary.club.name}. {dictionary.footer.rights}
          .
        </p>
      </div>
    </footer>
  );
}
