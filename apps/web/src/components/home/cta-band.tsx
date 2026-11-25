import { ButtonLink } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { CLUB_FACTS } from "@/config/club-facts";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import type { OfferView } from "./home-view";
import styles from "./cta-band.module.css";

/** شريط الدعوة بعرض الشاشة بالتدرّج ونص الحبر (6.8:1 فأكثر)، وزر أبيض. */
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
        <ButtonLink href="#plans" variant="light" external>
          {cta.action}
          <Icon name="arrow" />
        </ButtonLink>
        <p className={styles.note}>{fill(cta.note, { age: String(CLUB_FACTS.minimumAge) })}</p>
      </div>
    </section>
  );
}
