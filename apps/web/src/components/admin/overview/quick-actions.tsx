import Link from "next/link";
import type { CommandEntry } from "../shell/command-model";
import type { AdminDictionary } from "@/i18n/admin";
import { AdminIcon } from "../admin-icon";
import { Card } from "../ui/kit";
import styles from "./launch.module.css";

/** الإجراءات السريعة (§5.1): روابط إلى الصفحات التي تنفّذها، كلٌّ بصلاحيته (حسبها الخادم). */
export function QuickActions({
  actions,
  text,
}: {
  readonly actions: readonly CommandEntry[];
  readonly text: AdminDictionary["overview"]["quick"];
}) {
  if (actions.length === 0) {
    return null;
  }
  return (
    <Card title={text.title} description={text.lead} flush>
      <ul className={styles.actions} data-testid="quick-actions">
        {actions.map((action) => (
          <li key={action.id}>
            <Link href={action.href} prefetch={false} className={styles.action}>
              <span className={styles.actionIcon} aria-hidden="true">
                <AdminIcon name={action.icon} size={16} />
              </span>
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>{action.label}</span>
                <span className={styles.actionHint}>{action.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
