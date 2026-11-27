import Link from "next/link";
import { launchSummary, type LaunchEntry, type LaunchItem } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatList } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { AdminIcon, type AdminIconName } from "../admin-icon";
import { Badge, buttonClass } from "../ui/kit";
import styles from "./launch.module.css";

type LaunchText = AdminDictionary["overview"]["launch"];

/** فعل كل بند: رابط إلى الصفحة القائمة التي تنجزه بحارسها. ما لا فعل له هنا بلا رابط. */
const ACTIONS: Readonly<Partial<Record<LaunchItem, string>>> = {
  mfa: ADMIN_ROUTES.staff,
  plans: ADMIN_ROUTES.plansNew,
  salesSettings: ADMIN_ROUTES.salesSettings,
  content: ADMIN_ROUTES.content,
  slider: ADMIN_ROUTES.contentSlider,
};

const MARKS: Readonly<
  Record<LaunchEntry["state"], { icon?: AdminIconName; className?: string | undefined }>
> = {
  done: { icon: "check" },
  todo: { className: styles.markTodo },
  warn: { icon: "warn", className: styles.markWarn },
  later: { icon: "clock", className: styles.markLater },
  owner: { className: styles.markTodo },
};

function Item({
  entry,
  text,
  primary,
}: {
  entry: LaunchEntry;
  text: LaunchText;
  primary: boolean;
}) {
  const item = text.items[entry.item];
  const href = ACTIONS[entry.item];
  const mark = MARKS[entry.state];
  const hint =
    entry.item === "backup" && entry.state === "warn" ? text.items.backup.warnHint : item.hint;
  return (
    <li className={styles.item} data-item={entry.item} data-state={entry.state}>
      <span className={cx(styles.mark, mark.className)}>
        {mark.icon === undefined ? null : <AdminIcon name={mark.icon} size={14} />}
        <span className="sr-only">{text.states[entry.state]}</span>
      </span>
      <div>
        <p className={styles.itemTitle}>{item.title}</p>
        <p className={styles.itemHint}>{hint}</p>
      </div>
      <span className={styles.itemAction}>
        {href !== undefined && "action" in item ? (
          <Link
            href={href}
            prefetch={false}
            className={buttonClass({ variant: primary ? "primary" : "secondary", size: "small" })}
          >
            {item.action}
          </Link>
        ) : (
          <Badge tone={entry.state === "owner" ? "accent" : "neutral"}>
            {text.states[entry.state]}
          </Badge>
        )}
      </span>
    </li>
  );
}

function Progress({ entries, text }: { entries: readonly LaunchEntry[]; text: LaunchText }) {
  const done = entries.filter((entry) => entry.state === "done").length;
  const label = fill(text.progressLabel, { done: String(done), total: String(entries.length) });
  return (
    <div className={styles.track} role="img" aria-label={label}>
      {[...entries]
        .sort((a, b) => Number(b.state === "done") - Number(a.state === "done"))
        .map((entry) => (
          <span
            key={entry.item}
            className={cx(styles.segment, entry.state === "done" && styles.segmentDone)}
          />
        ))}
    </div>
  );
}

/**
 * «جهّز النادي للبيع الإلكتروني» (§5.1): البنود المفتوحة أولًا بفعلها، ثم ما ينتظر مرحلته أو قرار
 * المالك، والمكتملة رقائق في سطر. حين لا يبقى فعل ولا تحذير تصير شريطًا رفيعًا.
 */
export function LaunchCard({
  entries,
  text,
}: {
  entries: readonly LaunchEntry[];
  text: LaunchText;
}) {
  const summary = launchSummary(entries);
  const counts = { done: String(summary.done), total: String(summary.total) };
  if (summary.settled) {
    const waiting = summary.waiting.map((entry) => `«${text.items[entry.item].title}»`);
    return (
      <p className={styles.strip} data-testid="launch-settled">
        <AdminIcon name="check" size={16} />
        <strong>{fill(text.settled, counts)}</strong>
        {waiting.length === 0
          ? null
          : fill(text.settledWaiting, { items: formatList(waiting, "ar") })}
      </p>
    );
  }
  return (
    <section className={styles.card} aria-labelledby="launch-title" data-testid="launch-checklist">
      <div className={styles.head}>
        <div>
          <h2 id="launch-title" className={styles.title}>
            {text.title}
          </h2>
          <p className={styles.lead}>{text.lead}</p>
        </div>
        <p className={styles.progress} aria-hidden="true">
          {summary.done} <span className={styles.progressOf}>{fill(text.progressOf, counts)}</span>
        </p>
      </div>
      <Progress entries={entries} text={text} />
      <ul className={styles.list}>
        {[...summary.open, ...summary.waiting].map((entry, index) => (
          <Item key={entry.item} entry={entry} text={text} primary={index === 0} />
        ))}
      </ul>
      {summary.completed.length === 0 ? null : (
        <p className={styles.done}>
          <span>{text.completed}</span>
          {summary.completed.map((entry) => (
            <span key={entry.item} className={styles.chip} data-item={entry.item}>
              <AdminIcon name="check" size={14} />
              {text.items[entry.item].done}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
