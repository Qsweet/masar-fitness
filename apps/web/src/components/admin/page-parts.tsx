import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./page.module.css";

interface PageHeaderProps {
  readonly title: string;
  readonly lead?: string;
  readonly back?: { readonly href: string; readonly label: string };
  /** أفعال الصفحة (زر الإضافة مثلًا). */
  readonly children?: ReactNode;
}

export function PageHeader({ title, lead, back, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        {back === undefined ? null : (
          <Link href={back.href} prefetch={false} className={styles.back}>
            <span aria-hidden="true">→</span>
            {back.label}
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {lead === undefined ? null : <p className={styles.lead}>{lead}</p>}
      </div>
      {children}
    </header>
  );
}

interface PanelProps {
  readonly title: string;
  readonly lead?: string;
  /** محتوى بعرض نموذج (لا حقول بعرض الشاشة كلها). */
  readonly narrow?: boolean;
  readonly children: ReactNode;
}

/** بطاقة قسم داخل الصفحة بعنوانها. */
export function Panel({ title, lead, narrow, children }: PanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        {lead === undefined ? null : <p className={styles.panelLead}>{lead}</p>}
      </div>
      {narrow === true ? <div className={styles.narrowBody}>{children}</div> : children}
    </section>
  );
}

export function Badge({ tone, children }: { tone?: "accent" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cx(
        styles.badge,
        tone === "accent" && styles.badgeAccent,
        tone === "muted" && styles.badgeMuted,
      )}
    >
      {children}
    </span>
  );
}

/** قيمة لاتينية (بريد، عنوان، رمز) معزولة الاتجاه داخل النص العربي. */
export function Ltr({ children }: { readonly children: ReactNode }) {
  return <bdi className={styles.ltr}>{children}</bdi>;
}

export { styles as pageStyles };
