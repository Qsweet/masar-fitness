import { ButtonLink } from "@/components/ui/button-link";
import { CLUB_CONTACT, directionsUrl, whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";

interface LocationProps {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

export function Location({ locale, dictionary }: LocationProps) {
  const { location } = dictionary;
  return (
    <section
      id="location"
      aria-labelledby="location-title"
      className="surface-light surface-light-raised scroll-mt-4 py-20 md:py-28"
    >
      <div className="page-container grid gap-10 md:grid-cols-12">
        <h2 id="location-title" className="text-title font-display md:col-span-5">
          {location.title}
        </h2>
        <div className="md:col-span-6 md:col-start-7">
          <dl className="space-y-6">
            <div>
              <dt className="text-muted text-small font-medium">{location.addressLabel}</dt>
              <dd className="text-heading font-strong">{CLUB_CONTACT.address[locale]}</dd>
            </div>
            <div>
              <dt className="text-muted text-small font-medium">{location.phoneLabel}</dt>
              <dd className="text-heading font-strong">
                <a
                  href={`tel:${CLUB_CONTACT.phoneE164}`}
                  className="underline-offset-4 hover:underline"
                >
                  <bdi>{CLUB_CONTACT.phoneDisplay}</bdi>
                </a>
              </dd>
            </div>
          </dl>
          <p className="text-muted mt-6">{location.hoursNote}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <ButtonLink href={directionsUrl()} external>
              {location.directions}
            </ButtonLink>
            <ButtonLink href={whatsappUrl(location.whatsappMessage)} external variant="secondary">
              {location.whatsapp}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
