import { toPlanViews } from "@/components/plans/plan-view";
import { ButtonLink } from "@/components/ui/button-link";
import { Price } from "@/components/ui/price";
import { ROUTES } from "@/config/routes";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import { CatalogUnavailableError, getMembershipPlans } from "@/server/catalog";
import styles from "./membership-recommendation.module.css";

/** هذا العرض لا يحمل زر شراء (رابطه لصفحة الاشتراكات)، فلا يعتمد على علم الشراء. */
const NO_PURCHASE_LINK = false;

interface Props {
  readonly locale: Locale;
  readonly dictionary: Dictionary;
}

/** الكتالوج الحي، أو قائمة فارغة إن تعذرت القراءة: المقال يبقى مقروءًا والعطل مسجَّل في catalog.ts. */
async function livePlans() {
  try {
    return await getMembershipPlans();
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return [];
    }
    throw error;
  }
}

/**
 * توصية داخل المقال مربوطة بالكتالوج (PRODUCT_SPEC §7): السعر الحي للاشتراك الأوفر شهريًا
 * محسوبًا على الخادم، ورابط للمقارنة. لا شيء يُعرض إن لم يكن اشتراك معروضًا للبيع. لا سعر مكتوب هنا.
 */
export async function MembershipRecommendation({ locale, dictionary }: Props) {
  const views = toPlanViews(await livePlans(), locale, NO_PURCHASE_LINK);
  const plan = views.find((view) => view.isBestValue) ?? views[0];
  if (plan === undefined) {
    return null;
  }
  const { blog } = dictionary;
  const title = plan.isBestValue ? fill(blog.recommendationTitle, { plan: plan.name }) : plan.name;
  return (
    <aside className={styles.box} aria-label={blog.recommendationLabel}>
      <p className={styles.label}>{blog.recommendationLabel}</p>
      <p className={styles.title}>{title}</p>
      <p>
        <Price parts={plan.price} className={styles.price} unitClassName={styles.unit} />
      </p>
      <p className={styles.detail}>{plan.durationText}</p>
      {plan.monthlyText === undefined ? null : <p className={styles.detail}>{plan.monthlyText}</p>}
      <div className={styles.action}>
        <ButtonLink href={localizedPath(locale, ROUTES.memberships)} variant="primary">
          {blog.recommendationAction}
        </ButtonLink>
      </div>
    </aside>
  );
}
