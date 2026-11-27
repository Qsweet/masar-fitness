import Link from "next/link";
import styles from "./key-tree.module.css";

export interface KeyTreeItem {
  readonly href: string;
  readonly label: string;
  /** عدّ مختصر بجانب الاسم («12 من 14»). */
  readonly count: string;
  readonly current?: boolean;
}

export interface KeyTreeGroup {
  readonly id: string;
  readonly label: string;
  readonly open: boolean;
  readonly items: readonly KeyTreeItem[];
}

interface KeyTreeProps {
  readonly label: string;
  readonly groups: readonly KeyTreeGroup[];
}

/** شجرة روابط بمجموعات تُطوى (`<details>` أصلي): تعمل بلا JavaScript وبلوحة المفاتيح. */
export function KeyTree({ label, groups }: KeyTreeProps) {
  return (
    <nav aria-label={label} className={styles.tree}>
      {groups.map((group) => (
        <details key={group.id} open={group.open} className={styles.group}>
          <summary className={styles.summary}>
            <span>{group.label}</span>
            <span className={styles.groupCount}>{group.items.length}</span>
          </summary>
          <ul className={styles.list}>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={item.current === true ? "page" : undefined}
                  className={styles.link}
                >
                  <span className={styles.name}>{item.label}</span>
                  <span className={styles.count}>{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}
