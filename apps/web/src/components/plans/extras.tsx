import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import styles from "./extras.module.css";

/** ما يشمله الاشتراك: بطاقات صغيرة بعلامة صح. لا يظهر إن لم تُسجَّل مزايا. */
export function Benefits({
  eyebrow,
  title,
  benefits,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly benefits: readonly string[];
}) {
  if (benefits.length === 0) {
    return null;
  }
  return (
    <section className={cx("section", "section-alt")} aria-labelledby="benefits-title">
      <div className="container">
        <SectionHead id="benefits-title" eyebrow={eyebrow} title={title} />
        <ul className={styles.benefits}>
          {benefits.map((benefit) => (
            <li key={benefit}>
              <Icon name="check" className={styles.check} />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * طرق الدفع صفًا واحدًا مضغوطًا من الرقائق (الاسم وسطره). تعرضها الصفحة والشراء الإلكتروني مفتوح فقط (isCheckoutEnabled)؛ قبله يكفي سطر
 * واحد صادق بجانب زر واتساب (plan.buyNote)، حتى لا يبدو أن الموقع يقبل الدفع وهو لا يقبله.
 */
export function Payment({ dictionary }: { readonly dictionary: Dictionary }) {
  const { payment } = dictionary;
  return (
    <section className="section" aria-labelledby="payment-title">
      <div className="container">
        <SectionHead
          id="payment-title"
          eyebrow={payment.eyebrow}
          title={payment.title}
          lead={payment.note}
        />
        <ul className={styles.payments}>
          {payment.methods.map((method) => (
            <li key={method.name}>
              <strong>{method.name}</strong>
              <span className={styles.paymentNote}>{method.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
