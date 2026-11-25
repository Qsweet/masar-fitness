import Link from "next/link";
import { buttonClass } from "@/components/ui/button-link";
import { Icon, IconTile, type IconName } from "@/components/ui/icon";
import { PhotoBackdrop } from "@/components/ui/photo-backdrop";
import { TrackArc } from "@/components/ui/track-arc";
import { Price } from "@/components/ui/price";
import { SectionHead } from "@/components/ui/section-head";
import { CLUB_FACTS } from "@/config/club-facts";
import { PHOTOS } from "@/config/photos";
import { ROUTES } from "@/config/routes";
import { countText } from "@/i18n/count";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import type { PlanView } from "./plan-view";
import { PurchaseButton } from "./purchase-button";
import styles from "./plan-detail.module.css";

interface PlanDetailProps {
  readonly plan: PlanView;
  /** سطر الاشتراك من القاعدة («كل مرافق النادي في اشتراك واحد.») */
  readonly summary: string;
  readonly locale: Locale;
  readonly dictionary: Dictionary;
  /** معرّف رأس الصفحة (رابط التخطي وشريط الهاتف يقيسان به) */
  readonly id: string;
}

/** بطاقة السعر بجانب العنوان: الإجمالي للشخص، والمدة والشهري، وزر شراء واحد. */
function Offer({ plan, dictionary }: Pick<PlanDetailProps, "plan" | "dictionary">) {
  const { plan: labels } = dictionary;
  const viaWhatsapp = plan.purchase.kind === "whatsapp";
  return (
    <div className={styles.offer}>
      <p className={styles.label}>{labels.priceLabel}</p>
      <p className={styles.price}>
        <Price parts={plan.price} className="accent-text" unitClassName={styles.unit} />
      </p>
      <p className={styles.duration}>{plan.durationText}</p>
      {plan.monthlyText === undefined ? null : <p className={styles.monthly}>{plan.monthlyText}</p>}
      <PurchaseButton purchase={plan.purchase} className={buttonClass("primary", true)}>
        {viaWhatsapp ? labels.buyWhatsapp : labels.buyOnline}
        <Icon name="arrow" />
      </PurchaseButton>
      {viaWhatsapp ? (
        <p className={styles.note}>{labels.buyNote}</p>
      ) : (
        <a href={plan.whatsappHref} rel="noopener noreferrer" className={styles.alt}>
          {labels.whatsappAlternative}
        </a>
      )}
    </div>
  );
}

/** «+» لا يبقى وحده في آخر السطر: مسافة غير قابلة للكسر بينه وبين ما بعده («+ شهران مجانًا»). */
function keepPlusWithNext(text: string): string {
  return text.replaceAll("+ ", "+\u00a0");
}

/**
 * رأس صفحة الاشتراك فوق صورة صف البنش المظللة: الرجوع، ووسم الأوفر إن كان، والعنوان h1 باسم الباقة
 * التسويقي («رحلة الأبطال») وتحته المدة، وسطره،
 * وبطاقة السعر.
 */
export function PlanHero(props: PlanDetailProps) {
  const { plan, dictionary, locale } = props;
  return (
    <section id={props.id} className={styles.hero} aria-labelledby="plan-title">
      <PhotoBackdrop photo={PHOTOS.benchRow} />
      <TrackArc className={styles.track} />
      <div className={cx("container", styles.inner)}>
        <div className={styles.text}>
          <Link href={localizedPath(locale, ROUTES.memberships)} className={styles.back}>
            {dictionary.plan.back}
          </Link>
          {plan.isBestValue ? <p className={styles.badge}>{dictionary.plans.bestValue}</p> : null}
          <h1 id="plan-title" className={styles.title}>
            {plan.tier ?? keepPlusWithNext(plan.name)}
          </h1>
          {plan.tier === undefined ? null : (
            <p className={styles.subtitle}>{keepPlusWithNext(plan.name)}</p>
          )}
          <p className={styles.lead}>{props.summary}</p>
        </div>
        <Offer plan={plan} dictionary={dictionary} />
      </div>
    </section>
  );
}

type TermId = keyof Dictionary["plan"]["terms"];

/** أيقونة كل شرط بترتيب العرض. */
const TERMS: readonly { id: TermId; icon: IconName }[] = [
  { id: "activation", icon: "phone" },
  { id: "start", icon: "calendar" },
  { id: "freeze", icon: "snowflake" },
  { id: "personal", icon: "person" },
  { id: "age", icon: "shield" },
];

/** شروط الاشتراك من شروط النادي الحالية: التفعيل والبداية والتجميد وأنه شخصي وللرجال. */
export function PlanTerms({ plan, locale, dictionary }: Omit<PlanDetailProps, "summary" | "id">) {
  const { plan: labels } = dictionary;
  const values = {
    freeze: plan.freezeText,
    days: countText(CLUB_FACTS.freezeDaysPerPaidMonth, dictionary.days),
    age: String(CLUB_FACTS.minimumAge),
  };
  return (
    <section className="section" aria-labelledby="terms-title">
      <div className="container">
        <SectionHead id="terms-title" eyebrow={labels.termsEyebrow} title={labels.termsTitle} />
        <ul className={styles.terms}>
          {TERMS.map(({ id, icon }) => (
            <li key={id}>
              <IconTile name={icon} />
              <span>
                <strong>{fill(labels.terms[id].title, values)}</strong>
                <span>{fill(labels.terms[id].line, values)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.compare}>
          <Link href={`${localizedPath(locale, ROUTES.memberships)}#compare`}>
            {dictionary.plans.compare}
          </Link>
        </p>
      </div>
    </section>
  );
}
