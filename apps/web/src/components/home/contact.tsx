import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Icon, IconTile, type IconName } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { CLUB_CONTACT, directionsUrl, whatsappUrl } from "@/config/club";
import { CLUB_FACTS } from "@/config/club-facts";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { ContactForm } from "./contact-form";
import { hoursRows } from "./hours-view";
import styles from "./contact.module.css";

interface ContactProps {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

function InfoCard({
  icon,
  title,
  children,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <li className={styles.info}>
      <IconTile name={icon} />
      <h3 className={styles.infoTitle}>{title}</h3>
      <div className={styles.infoBody}>{children}</div>
    </li>
  );
}

function InfoCards({ locale, dictionary }: ContactProps) {
  const { contact, location } = dictionary;
  return (
    <ul className={styles.infos}>
      <InfoCard icon="pin" title={contact.visit}>
        <p>{CLUB_CONTACT.address[locale]}</p>
      </InfoCard>
      <InfoCard icon="phone" title={contact.call}>
        <a href={`tel:${CLUB_CONTACT.phoneE164}`}>
          <bdi dir="ltr">{CLUB_CONTACT.phoneDisplay}</bdi>
        </a>
        <a href={whatsappUrl(location.whatsappMessage)} rel="noopener noreferrer">
          {location.whatsapp}
        </a>
      </InfoCard>
      <InfoCard icon="mail" title={contact.email}>
        <a href={`mailto:${CLUB_FACTS.email}`}>
          <bdi>{CLUB_FACTS.email}</bdi>
        </a>
      </InfoCard>
      <InfoCard icon="clock" title={contact.hours}>
        <dl className={styles.hoursList}>
          {hoursRows("club", dictionary).map((row) => (
            <div key={row.days}>
              <dt>{row.days}</dt>
              <dd>{row.range}</dd>
            </div>
          ))}
        </dl>
      </InfoCard>
    </ul>
  );
}

/** بطاقة الخريطة: رسم شبكي مرسوم بـCSS ودبوس، ورابط إلى خرائط Google (لا تضمين لطرف ثالث). */
function MapCard({ dictionary }: Pick<ContactProps, "dictionary">) {
  return (
    <div className={styles.map}>
      <span className={styles.pin} aria-hidden="true">
        <Icon name="pin" />
      </span>
      <p className={styles.mapTitle}>{dictionary.contact.mapTitle}</p>
      <ButtonLink href={directionsUrl()} external>
        {dictionary.location.directions}
        <Icon name="arrow" />
      </ButtonLink>
    </div>
  );
}

/** «تواصل معنا»: نموذج يفتح واتساب برسالة جاهزة، وأربع بطاقات معلومات، وبطاقة الخريطة. */
export function Contact({ locale, dictionary }: ContactProps) {
  const { contact } = dictionary;
  return (
    <section id="contact" className="section" aria-labelledby="contact-title">
      <div className="container">
        <SectionHead
          id="contact-title"
          eyebrow={contact.eyebrow}
          title={contact.title}
          lead={contact.lead}
        />
        <div className={styles.layout}>
          <ContactForm
            copy={contact}
            whatsappNumber={CLUB_CONTACT.whatsappNumber}
            fallbackHref={whatsappUrl(dictionary.location.whatsappMessage)}
          />
          <div className={cx(styles.side)}>
            <InfoCards locale={locale} dictionary={dictionary} />
            <MapCard dictionary={dictionary} />
          </div>
        </div>
      </div>
    </section>
  );
}
