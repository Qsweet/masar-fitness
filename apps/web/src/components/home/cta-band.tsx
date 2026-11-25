import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import { TrackArc } from "@/components/ui/track-arc";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS } from "@/config/photos";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import type { OfferView } from "./home-view";
import styles from "./cta-band.module.css";

/**
 * شريط الدعوة بعرض الشاشة: صورة المنطقة الوظيفية خلف تظليل أسود كثيف وتوهج أصفر خفيف في الوسط، والمضمار
 * بخطه المتقطع في أسفله، والزر الأصفر. الصورة زخرفية (alt فارغ) لأن النص يحمل المعنى.
 */
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
      <Image
        className={styles.photo}
        src={PHOTOS.functionalZone}
        alt=""
        fill
        placeholder="blur"
        sizes="100vw"
      />
      <div className={styles.scrim} aria-hidden="true" />
      <TrackArc className={styles.track} />
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
        <ButtonLink href="#plans" variant="primary" external>
          {cta.action}
          <Icon name="arrow" />
        </ButtonLink>
        <p className={styles.note}>{fill(cta.note, { age: String(CLUB_FACTS.minimumAge) })}</p>
      </div>
    </section>
  );
}
