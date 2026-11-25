import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionHead } from "@/components/ui/section-head";
import { whatsappUrl } from "@/config/club";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { Configurator } from "./configurator";
import { initialPlanSlug, type PlanView } from "./plan-view";
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
  /** ما يلي المحدِّد داخل القسم نفسه (عرض الأصدقاء). */
  readonly children?: ReactNode;
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

/** روابط المقارنة وحاسبة تكلفة الزيارة تحت الملخص (لا تظهر في صفحة المقارنة نفسها). */
function MoreLinks({ locale, dictionary }: Pick<PlansSectionProps, "locale" | "dictionary">) {
  return (
    <ul className={styles.more}>
      <li>
        <Link href={`${localizedPath(locale, ROUTES.memberships)}#compare`}>
          {dictionary.plans.compare}
        </Link>
      </li>
      <li>
        <Link href={localizedPath(locale, ROUTES.costPerVisit)}>
          {dictionary.tools.costPerVisit.membershipsLink}
        </Link>
      </li>
    </ul>
  );
}

/** قسم الاشتراكات (#plans): رأس القسم ثم بطاقات الأسعار وملخصها، بالشكل نفسه في كل صفحة. */
export function PlansSection(props: PlansSectionProps) {
  const { plans, locale, dictionary, currentSlug, revealAfterId, showCompare = false } = props;
  const initialSlug = initialPlanSlug(plans, currentSlug);
  return (
    <section id="plans" className={cx("section", styles.plans)} aria-labelledby="plans-title">
      <div className="container">
        <SectionHead
          id="plans-title"
          eyebrow={dictionary.plans.eyebrow}
          title={dictionary.plans.title}
          lead={dictionary.plans.lead}
        />
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
            more={
              showCompare && plans.length > 1 ? (
                <MoreLinks locale={locale} dictionary={dictionary} />
              ) : undefined
            }
          />
        )}
        {props.children}
      </div>
    </section>
  );
}
