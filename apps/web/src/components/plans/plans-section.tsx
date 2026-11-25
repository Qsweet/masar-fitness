import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { whatsappUrl } from "@/config/club";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { Configurator } from "./configurator";
import { initialPlanSlug, type PlanView } from "./plan-view";
import { cx } from "@/lib/cx";
import styles from "./plans-section.module.css";

interface PlansSectionProps {
  readonly plans: readonly PlanView[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
  /** اشتراك الصفحة الحالية، يُختار أولًا. */
  readonly currentSlug?: string;
  /** شريط الشراء الثابت يظهر بعد أن يغادر هذا العنصر الشاشة. */
  readonly revealAfterId: string;
  /** رابط «قارن الاشتراكات» (لا يظهر في صفحة المقارنة نفسها). */
  readonly showCompare?: boolean;
}

/** لا اشتراكات معروضة: نوجّه الزائر لقناة تعمل بدل قائمة فارغة. */
function EmptyPlans({ dictionary }: { readonly dictionary: Dictionary }) {
  return (
    <div className={styles.empty}>
      <p className="title-block">{dictionary.plans.emptyTitle}</p>
      <p className="muted">{dictionary.plans.emptyLead}</p>
      <ButtonLink href={whatsappUrl(dictionary.location.whatsappMessage)} external>
        {dictionary.plans.emptyAction}
      </ButtonLink>
    </div>
  );
}

/** قسم الاشتراكات (#plans): العنوان ثم محدِّد المدة، بالشكل نفسه في كل صفحة. */
export function PlansSection(props: PlansSectionProps) {
  const { plans, locale, dictionary, currentSlug, revealAfterId, showCompare = false } = props;
  const initialSlug = initialPlanSlug(plans, currentSlug);
  return (
    <section id="plans" className={cx("container", styles.plans)} aria-labelledby="plans-title">
      <div className={styles.head}>
        <h2 id="plans-title" className="title-section">
          {dictionary.plans.title}
        </h2>
        <p className="muted">{dictionary.plans.lead}</p>
      </div>
      {initialSlug === undefined ? (
        <EmptyPlans dictionary={dictionary} />
      ) : (
        <Configurator
          plans={plans}
          initialSlug={initialSlug}
          currentSlug={currentSlug}
          revealAfterId={revealAfterId}
          labels={dictionary.plans}
          planLabels={dictionary.plan}
        />
      )}
      {showCompare && plans.length > 1 ? (
        <p className={styles.compare}>
          <Link href={`${localizedPath(locale, "/memberships")}#compare`}>
            {dictionary.plans.compare}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
