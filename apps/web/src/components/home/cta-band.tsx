import { ButtonLink } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { TrackArc } from "@/components/ui/track-arc";
import { CLUB_FACTS } from "@/config/club-facts";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import type { OfferView } from "./home-view";
import styles from "./cta-band.module.css";

/** شريط الدعوة بعرض الشاشة بأصفر الشعار ونص أسود (14:1)، ومضمار أسود في أسفله، وزر أسود. */
export function CtaBand({
  dictionary,
  offer,
}: {
  readonly dictionary: Dictionary;
  readonly offer: OfferView | undefined;
}) {
  const { cta } = dictionary;
  return (
    <section className={styles.band} aria-labelledby="cta-title">
      <TrackArc className={styles.track} solid />
      <div className={styles.inner}>
        {offer === undefined ? null : (
          <p className={styles.pill}>
            <Icon name="sparkle" />
            {offer.title} · {offer.line}
          </p>
        )}
        <h2 id="cta-title" className={styles.title}>
          {cta.title}
        </h2>
        <p className={styles.lead}>{cta.lead}</p>
        <ButtonLink href="#plans" variant="ink" external>
          {cta.action}
          <Icon name="arrow" />
        </ButtonLink>
        <p className={styles.note}>{fill(cta.note, { age: String(CLUB_FACTS.minimumAge) })}</p>
      </div>
    </section>
  );
}
