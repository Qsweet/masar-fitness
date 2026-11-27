import Link from "next/link";
import { launchSummary, type LaunchEntry, type LaunchItem } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { countText } from "@/i18n/count";
import { fill } from "@/i18n/fill";
import { formatList } from "@/i18n/format";
import { cx } from "@/lib/cx";
import { launchCounts, type LaunchView } from "@/server/admin/overview/launch-view";
import { AdminIcon, type AdminIconName } from "../admin-icon";
import { Badge, buttonClass } from "../ui/kit";
import styles from "./launch.module.css";

type OverviewText = AdminDictionary["overview"];
type LaunchText = OverviewText["launch"];

/** فعل كل بند: رابط إلى الصفحة القائمة التي تنجزه بحارسها. ما لا صفحة له في اللوحة بلا رابط. */
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

/**
 * الجملة الواحدة التي تقولها التحية والبطاقة معًا (§5.1): ما اكتمل من الثمانية، وما بيد هذا الموظف،
 * وما بيد المالك، وما ينتظر مرحلته أو قراره.
 */
export function launchSentence(view: LaunchView, text: OverviewText): string {
  const counts = launchCounts(view);
  const { summary, items } = text.launch;
  const waiting = counts.waiting.map((entry) => items[entry.item].title);
  return [
    fill(summary.done, { done: String(counts.done), total: String(counts.total) }),
    counts.mine === 0 ? null : fill(summary.mine, { steps: countText(counts.mine, text.steps) }),
    counts.owner === 0 ? null : fill(summary.owner, { steps: countText(counts.owner, text.steps) }),
    waiting.length === 0 ? null : fill(summary.waiting, { items: formatList(waiting, "ar") }),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

function hintOf(entry: LaunchEntry, view: LaunchView, text: LaunchText): string {
  if (entry.item === "backup" && entry.state === "warn") {
    return text.items.backup.warnHint;
  }
  if (entry.item === "payments" && view.payments === "off") {
    return text.items.payments.hintOff;
  }
  return text.items[entry.item].hint;
}

interface ItemProps {
  readonly entry: LaunchEntry;
  readonly view: LaunchView;
  readonly text: LaunchText;
  readonly primary: boolean;
}

function ItemAction({ entry, view, text, primary }: ItemProps) {
  const item = text.items[entry.item];
  const href = ACTIONS[entry.item];
  if (href !== undefined && "action" in item && view.actionable.includes(entry.item)) {
    const variant = primary ? "primary" : "secondary";
    return (
      <Link href={href} prefetch={false} className={buttonClass({ variant, size: "small" })}>
        {item.action}
      </Link>
    );
  }
  const open = entry.state === "todo" || entry.state === "warn";
  const mine = view.actionable.includes(entry.item);
  return (
    <Badge tone={entry.state === "owner" ? "accent" : "neutral"}>
      {open && !mine ? text.states.ownerHand : text.states[entry.state]}
    </Badge>
  );
}

function Item(props: ItemProps) {
  const { entry, view, text } = props;
  const mark = MARKS[entry.state];
  return (
    <li className={styles.item} data-item={entry.item} data-state={entry.state}>
      <span className={cx(styles.mark, mark.className)}>
        {mark.icon === undefined ? null : <AdminIcon name={mark.icon} size={14} />}
        <span className="sr-only">{text.states[entry.state]}</span>
      </span>
      <div>
        <p className={styles.itemTitle}>{text.items[entry.item].title}</p>
        <p className={styles.itemHint}>{hintOf(entry, view, text)}</p>
      </div>
      <span className={styles.itemAction}>
        <ItemAction {...props} />
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

function SettledStrip({ view, text }: { view: LaunchView; text: LaunchText }) {
  const counts = launchCounts(view);
  const waiting = counts.waiting.map((entry) => `«${text.items[entry.item].title}»`);
  return (
    <p className={styles.strip} data-testid="launch-settled">
      <AdminIcon name="check" size={16} />
      <strong>
        {fill(text.settled, { done: String(counts.done), total: String(counts.total) })}
      </strong>
      {waiting.length === 0
        ? null
        : fill(text.settledWaiting, { items: formatList(waiting, "ar") })}
    </p>
  );
}

/**
 * «جهّز النادي للبيع الإلكتروني» (§5.1): الملخص على البنود الثمانية كلها، والمفتوحة أولًا بفعلها لمن
 * يملكه («بيد المالك» لغيره)، ثم ما ينتظر، والمكتملة رقائق. حين لا يبقى مفتوح لأحد: شريط رفيع.
 */
export function LaunchCard({ view, text }: { view: LaunchView; text: OverviewText }) {
  const launch = text.launch;
  const summary = launchSummary(view.entries);
  if (summary.settled) {
    return <SettledStrip view={view} text={launch} />;
  }
  const counts = { done: String(summary.done), total: String(summary.total) };
  return (
    <section className={styles.card} aria-labelledby="launch-title" data-testid="launch-checklist">
      <div className={styles.head}>
        <div>
          <h2 id="launch-title" className={styles.title}>
            {launch.title}
          </h2>
          <p className={styles.lead}>{launchSentence(view, text)}</p>
        </div>
        <p className={styles.progress} aria-hidden="true">
          {summary.done}{" "}
          <span className={styles.progressOf}>{fill(launch.progressOf, counts)}</span>
        </p>
      </div>
      <Progress entries={view.entries} text={launch} />
      <ul className={styles.list}>
        {[...summary.open, ...summary.waiting].map((entry, index) => (
          <Item key={entry.item} entry={entry} view={view} text={launch} primary={index === 0} />
        ))}
      </ul>
      {summary.completed.length === 0 ? null : (
        <p className={styles.done}>
          <span>{launch.completed}</span>
          {summary.completed.map((entry) => (
            <span key={entry.item} className={styles.chip} data-item={entry.item}>
              <AdminIcon name="check" size={14} />
              {launch.items[entry.item].done}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
