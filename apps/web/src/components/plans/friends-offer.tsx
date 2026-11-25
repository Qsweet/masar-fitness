import { ButtonLink } from "@/components/ui/button-link";
import { Icon, IconTile } from "@/components/ui/icon";
import { Price } from "@/components/ui/price";
import type { FriendsView } from "@/components/home/services-view";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./friends-offer.module.css";

/** عرض الأصدقاء تحت بطاقات الأسعار: ثلاثة يشتركون معًا، والحجز عبر واتساب (لا شراء إلكتروني له). */
export function FriendsOffer({
  dictionary,
  view,
}: {
  readonly dictionary: Dictionary;
  readonly view: FriendsView;
}) {
  const { friends } = dictionary;
  return (
    <aside id="friends" className={styles.offer} aria-labelledby="friends-title">
      <IconTile name="users" className={styles.tile} />
      <div className={styles.text}>
        <p className="eyebrow">{friends.eyebrow}</p>
        <h3 id="friends-title" className={styles.title}>
          {friends.title}
        </h3>
        <p className={styles.line}>{view.line}</p>
        <p className={styles.note}>{friends.total}</p>
      </div>
      <div className={styles.buy}>
        <Price parts={view.price} className={styles.price} unitClassName={styles.unit} />
        <p className={styles.note}>{view.perPerson}</p>
        <ButtonLink href={view.href} variant="outline" external>
          <Icon name="chat" />
          {friends.action}
        </ButtonLink>
      </div>
    </aside>
  );
}
