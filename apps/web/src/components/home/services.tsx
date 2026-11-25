import { Icon, type IconName } from "@/components/ui/icon";
import { PhotoCard } from "@/components/ui/photo-card";
import { Price } from "@/components/ui/price";
import { SectionHead } from "@/components/ui/section-head";
import { PHOTOS, type PhotoKey } from "@/config/photos";
import type { ServiceId } from "@/config/services";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ServiceView } from "./services-view";
import grid from "./card-grid.module.css";
import styles from "./services.module.css";

const CARD_SIZES = "(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw";

/** صورة كل خدمة وأيقونة صفها. السباحة بصورة المسبح نفسه. */
const LOOK: Readonly<Record<ServiceId, { photo: PhotoKey; icon: IconName }>> = {
  personalTraining: { photo: "coachTalk", icon: "person" },
  rehab: { photo: "consultation", icon: "heart" },
  swimming: { photo: "pool", icon: "waves" },
};

function Packages({ service, label }: { readonly service: ServiceView; readonly label: string }) {
  return (
    <details className={styles.packages}>
      <summary>{label}</summary>
      <ul>
        {service.packages.map((item) => (
          <li key={item.sessions}>
            <span>{item.sessions}</span>
            <Price parts={item.price} className={styles.price} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function ServiceCard({
  service,
  dictionary,
}: {
  readonly service: ServiceView;
  readonly dictionary: Dictionary;
}) {
  const { services, photos } = dictionary;
  const look = LOOK[service.id];
  return (
    <PhotoCard
      photo={{ src: PHOTOS[look.photo], alt: photos[look.photo] }}
      sizes={CARD_SIZES}
      title={service.name}
      line={service.line}
      meta={{ icon: look.icon, text: service.range }}
      badge={service.from}
      note={service.note === "" ? undefined : service.note}
    >
      <Packages service={service} label={services.packages} />
      <a href={service.askHref} rel="noopener noreferrer" className={styles.ask}>
        <Icon name="chat" />
        {services.ask}
      </a>
    </PhotoCard>
  );
}

/**
 * البرامج المدفوعة غير القابلة للشراء من الموقع بعد: ثلاث بطاقات بنمط البرامج، والطلب عبر واتساب.
 * BE STRONG 45 لا يُذكر ما دام «قيد الإعداد» في موقع النادي: لا سطر عن منتج غير موجود.
 */
export function Services({
  dictionary,
  services,
}: {
  readonly dictionary: Dictionary;
  readonly services: readonly ServiceView[];
}) {
  const copy = dictionary.services;
  return (
    <section id="services" className="section" aria-labelledby="services-title">
      <div className="container">
        <SectionHead
          id="services-title"
          eyebrow={copy.eyebrow}
          title={copy.title}
          lead={copy.lead}
        />
        <ul className={grid.grid}>
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} dictionary={dictionary} />
          ))}
        </ul>
      </div>
    </section>
  );
}
