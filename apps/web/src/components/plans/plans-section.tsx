import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionHead } from "@/components/ui/section-head";
import { whatsappUrl } from "@/config/club";
import { PHOTOS } from "@/config/photos";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { localizedPath, type Locale } from "@/i18n/locales";
import { cx } from "@/lib/cx";
import { PlanPicker } from "./plan-picker";
import { initialPlanSlug, type PlanView } from "./plan-view";
import styles from "./plans-section.module.css";

interface PlansSectionProps {
  readonly plans: readonly PlanView[];
  readonly locale: Locale;
  readonly dictionary: Dictionary;
  /** شريط الهاتف لا يظهر قبل تجاوز هذا العنصر (رأس صفحة الاشتراكات، والمحدِّد ظاهر تحته مباشرة) */
  readonly revealAfterId?: string;
  /** رابط «قارن الاشتراكات» (لا يظهر في صفحة المقارنة نفسها). */
  readonly showCompare?: boolean;
  /** سطر «الاشتراكات» فوق العنوان؛ يُسقط في صفحة الاشتراكات حيث رأس الصفحة يقوله. */
  readonly showEyebrow?: boolean;
  /** صورة الأجهزة خلف الرأس؛ تُسقط حيث فوق القسم رأس مصوَّر (صفحة الاشتراكات). */
  readonly backdrop?: boolean;
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

/** روابط المقارنة وحاسبة تكلفة الزيارة تحت البطاقة (لا تظهر في صفحة المقارنة نفسها). */
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

/**
 * قسم الاشتراكات (#plans): رأس القسم ثم مبدّل المدة وبطاقته الكبيرة، بالشكل نفسه في كل صفحة. خلف الرأس صورة
 * الأجهزة الصفراء تتلاشى إلى الأسود قبل البطاقات (زخرفية، alt فارغ).
 */
export function PlansSection(props: PlansSectionProps) {
  const { plans, locale, dictionary, showCompare = false } = props;
  const { showEyebrow = true, backdrop = true } = props;
  const initialSlug = initialPlanSlug(plans);
  return (
    <section id="plans" className={cx("section", styles.plans)} aria-labelledby="plans-title">
      {backdrop ? (
        <Image
          className={styles.backdrop}
          src={PHOTOS.machinesTurf}
          alt=""
          placeholder="blur"
          sizes="100vw"
        />
      ) : null}
      <div className={cx("container", styles.inner)}>
        <SectionHead
          id="plans-title"
          eyebrow={showEyebrow ? dictionary.plans.eyebrow : undefined}
          title={dictionary.plans.title}
          lead={dictionary.plans.lead}
        />
        {initialSlug === undefined ? (
          <EmptyPlans dictionary={dictionary} />
        ) : (
          <PlanPicker
            plans={plans}
            initialSlug={initialSlug}
            labels={dictionary.plans}
            planLabels={dictionary.plan}
            revealAfterId={props.revealAfterId}
            chat={{
              href: whatsappUrl(dictionary.location.whatsappMessage),
              label: dictionary.chat,
            }}
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
