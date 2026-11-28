import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { AdminIcon, type AdminIconName } from "../admin-icon";
import styles from "./ui.module.css";

/** عدّة واجهة اللوحة (مكوّنات خادم بلا حالة). الأنماط في ui.module.css والرموز في app/admin/admin.css. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";

interface ButtonStyle {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly block?: boolean;
}

/** أصناف الزر، لزر حقيقي أو رابط بمظهره. */
export function buttonClass({ variant = "secondary", size = "medium", block }: ButtonStyle = {}) {
  return cx(
    styles.button,
    styles[variant],
    size !== "medium" && styles[size],
    block === true && styles.block,
  );
}

type ButtonLinkProps = ButtonStyle & {
  readonly href: string;
  readonly children: ReactNode;
  readonly label?: string;
};

export function ButtonLink({ href, children, label, ...style }: ButtonLinkProps) {
  return (
    <Link href={href} prefetch={false} className={buttonClass(style)} aria-label={label}>
      {children}
    </Link>
  );
}

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string | undefined;
  /** شارة بجانب العنوان (حالة الحساب مثلًا). */
  readonly badge?: ReactNode;
  /** رابط رجوع فوق العنوان (صفحات التفصيل). */
  readonly back?: { readonly href: string; readonly label: string } | undefined;
  /** أفعال الصفحة. */
  readonly children?: ReactNode;
}

/**
 * رأس الصفحة: عنوان Alexandria بحجم منتج (1.5rem)، ووصف بطول سطر يُقرأ، وأفعال في جهة النهاية، ورابط
 * رجوع اختياري. مسار التنقل في الشريط العلوي، والتبويبات تحته بـ`Tabs`.
 */
export function PageHeader({ title, description, badge, back, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        {back === undefined ? null : (
          <Link href={back.href} prefetch={false} className={styles.back}>
            <AdminIcon name="fwd" />
            {back.label}
          </Link>
        )}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {badge}
        </div>
        {description === undefined ? null : <p className={styles.description}>{description}</p>}
      </div>
      {children === undefined ? null : <div className={styles.actions}>{children}</div>}
    </header>
  );
}

interface CardProps {
  readonly title?: string;
  readonly description?: string | undefined;
  /** فعل في رأس البطاقة. */
  readonly action?: ReactNode;
  /** المحتوى يلامس حواف البطاقة (جدول). */
  readonly flush?: boolean;
  /** محتوى بعرض نموذج. */
  readonly narrow?: boolean;
  readonly accent?: boolean;
  readonly children: ReactNode;
}

export function Card({ title, description, action, flush, narrow, accent, children }: CardProps) {
  return (
    <section className={cx(styles.card, accent === true && styles.accentCard)}>
      {title === undefined ? null : (
        <div className={styles.cardHead}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{title}</h2>
            {action}
          </div>
          {description === undefined ? null : <p className={styles.cardLead}>{description}</p>}
        </div>
      )}
      <div className={cx(styles.cardBody, flush === true && styles.cardFlush)}>
        {narrow === true ? <div className={styles.narrow}>{children}</div> : children}
      </div>
    </section>
  );
}

/** رابط خافت في رأس بطاقة («كل السجل»، «صفحة العميل»). */
export function CardLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <Link href={href} prefetch={false} className={styles.cardLink}>
      {children}
    </Link>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const BADGE_TONES: Readonly<Record<Tone, string | undefined>> = {
  neutral: undefined,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
  accent: styles.badgeAccent,
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx(styles.badge, BADGE_TONES[tone])}>{children}</span>;
}

const ALERT_TONES = {
  danger: styles.alertDanger,
  success: styles.alertSuccess,
  info: styles.alertInfo,
  warning: styles.alertWarning,
} as const;

interface AlertProps {
  readonly tone: keyof typeof ALERT_TONES;
  readonly children: ReactNode;
}

/** تنبيه داخل الصفحة. `success` و`info` حالة (role=status)، و`danger` و`warning` تنبيه. */
export function Alert({ tone, children }: AlertProps) {
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return (
    <p role={role} className={cx(styles.alert, ALERT_TONES[tone])}>
      {children}
    </p>
  );
}

/** نص تنبيه النجاح من قيمة `?done=` في الرابط؛ undefined لقيمة مجهولة أو غائبة. */
export function noticeText(
  done: string | string[] | undefined,
  dictionary: AdminDictionary,
): string | undefined {
  const text = typeof done === "string" ? lookup(dictionary.notices, done, "") : "";
  return text === "" ? undefined : text;
}

/** تنبيه نجاح بعد إجراء (من `?done=` في الرابط). */
export function Notice({ text }: { readonly text: string | undefined }) {
  return text === undefined ? null : <Alert tone="success">{text}</Alert>;
}

interface EmptyStateProps {
  readonly icon: AdminIconName;
  readonly title: string;
  readonly description?: string | undefined;
  readonly children?: ReactNode;
}

/** حالة فارغة: ما الذي سيظهر هنا، ومتى. */
export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <AdminIcon name={icon} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {description === undefined ? null : <p className={styles.emptyLead}>{description}</p>}
      {children}
    </div>
  );
}

interface TabsProps {
  readonly label: string;
  readonly current: string;
  readonly tabs: readonly {
    readonly id: string;
    readonly label: string;
    readonly href: string;
    /** عدّاد مكتوب (رقم منسَّق)، يُعلَن مع اسم التبويب. */
    readonly count?: string | undefined;
  }[];
}

/** تبويبات بروابط: كل تبويب رابط حقيقي يعمل بلا JavaScript ويُشارَك ويُحفظ. */
export function Tabs({ label, current, tabs }: TabsProps) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          prefetch={false}
          aria-current={tab.id === current ? "page" : undefined}
          className={styles.tab}
        >
          {tab.label}
          {tab.count === undefined ? null : <span className={styles.tabCount}>{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

interface DetailLayoutProps {
  readonly main: ReactNode;
  readonly aside: ReactNode;
}

/**
 * تخطيط التفصيل (ADMIN_REDESIGN §3.4، «1 + 360px»): عمود رئيسي مرن وعمود جانبي ثابت في جهة النهاية
 * (البيانات والخط الزمني). تحت 64rem عمود واحد: الجانبي أولًا لأنه هوية الكيان.
 */
export function DetailLayout({ main, aside }: DetailLayoutProps) {
  return (
    <div className={styles.detail}>
      <div className={styles.detailAside}>{aside}</div>
      <div className={styles.detailMain}>{main}</div>
    </div>
  );
}

/** شبكة بطاقات: عمودان على الشاشة الواسعة، فلا تتراكم بطاقات قصيرة بعرض الصفحة كله. */
export function CardGrid({ children }: { readonly children: ReactNode }) {
  return <div className={styles.cardGrid}>{children}</div>;
}

/** قيمة لاتينية (بريد، عنوان، رقم مرجع) معزولة الاتجاه داخل النص العربي. */
export function Ltr({ children }: { readonly children: ReactNode }) {
  return <bdi className={styles.ltr}>{children}</bdi>;
}

interface FactsProps {
  readonly items: readonly (readonly [label: string, value: ReactNode])[];
}

/** قائمة «التسمية: القيمة» بخطوط شعرية. */
export function Facts({ items }: FactsProps) {
  return (
    <dl className={styles.facts}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.fact}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface TimelineEntry {
  readonly id: string;
  readonly title: string;
  /** الوقت ومن فعل، في سطر واحد خافت. */
  readonly meta: ReactNode;
  /** تفاصيل «التسمية: القيمة». */
  readonly lines?: readonly string[];
}

/** خط زمني عمودي: الأقدم أولًا، ولكل حدث نقطة وعنوان ووقت وفاعل. */
export function Timeline({ entries }: { readonly entries: readonly TimelineEntry[] }) {
  return (
    <ol className={styles.timeline}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.timelineItem}>
          <p className={styles.timelineTitle}>{entry.title}</p>
          <p className={styles.timelineMeta}>{entry.meta}</p>
          {entry.lines?.map((line) => (
            <bdi key={line} className={styles.timelineLine}>
              {line}
            </bdi>
          ))}
        </li>
      ))}
    </ol>
  );
}

type SecretProps = ComponentProps<"code">;

/** سر يُعرض مرة (كلمة مؤقتة، مفتاح): خط ثابت العرض، يُحدَّد كله بنقرة. */
export function SecretValue(props: SecretProps) {
  return <code className={styles.secretValue} {...props} />;
}

export { styles as uiStyles };
