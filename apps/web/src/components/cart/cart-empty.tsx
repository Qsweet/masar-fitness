import { ButtonLink } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { CartHelp } from "./cart-help";
import styles from "./cart.module.css";

/** السلة الفارغة: عنوان صادق ورابط العضويات ومساعدة واتساب. */
export function CartEmpty({
  labels,
  membershipsHref,
}: {
  readonly labels: Dictionary["cart"];
  readonly membershipsHref: string;
}) {
  return (
    <section aria-labelledby="cart-empty-title" className={styles.empty}>
      <h2 id="cart-empty-title" className={styles.emptyTitle}>
        {labels.empty.title}
      </h2>
      <p className={styles.muted}>{labels.empty.lead}</p>
      <ButtonLink href={membershipsHref}>{labels.empty.action}</ButtonLink>
      <CartHelp labels={labels} />
    </section>
  );
}
