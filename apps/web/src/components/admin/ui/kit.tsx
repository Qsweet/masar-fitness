import Link from "next/link";
import type { ReactNode } from "react";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { AdminIcon, type AdminIconName } from "../admin-icon";
import { uiStyles as styles } from "./ui-styles";

/** عدّة واجهة اللوحة (مكوّنات خادم بلا حالة). الأنماط في ui-styles.ts (وحدات CSS بالموضوع) والرموز في app/admin/admin.css. */
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
  /** بطاقة بعرض نموذج (صفحات التأكيد): البطاقة نفسها تضيق، لا محتواها داخل بطاقة بعرض الصفحة. */
  readonly narrow?: boolean;
  readonly accent?: boolean;
  readonly children: ReactNode;
}

export function Card({ title, description, action, flush, narrow, accent, children }: CardProps) {
  return (
    <section
      className={cx(
        styles.card,
        accent === true && styles.accentCard,
        narrow === true && styles.narrowCard,
      )}
    >
      {title === undefined ? null : (
        <div className={styles.cardHead}>
          <div className={styles.cardTitleRow}>
            <h2 className={styles.cardTitle}>{title}</h2>
            {action}
          </div>
          {description === undefined ? null : <p className={styles.cardLead}>{description}</p>}
        </div>
      )}
      <div className={cx(styles.cardBody, flush === true && styles.cardFlush)}>{children}</div>
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

export {
  CardGrid,
  DetailLayout,
  Facts,
  Ltr,
  SecretValue,
  Timeline,
  type TimelineEntry,
} from "./kit-layout";

export { styles as uiStyles };
