import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { AdminIcon } from "../admin-icon";
import styles from "./section.module.css";

interface SettingsSectionProps {
  readonly title: string;
  /** سطر أو سطران عن القسم؛ الشرح الطويل في `Disclosure` داخل اللوحة. */
  readonly description?: string | undefined;
  /** ما تحت الوصف في عمود العنوان (شارة حالة، رابط مساعدة). */
  readonly aside?: ReactNode;
  /** مرساة داخل الصفحة. */
  readonly id?: string;
  readonly tone?: "default" | "danger" | "accent";
  readonly testId?: string;
  readonly children: ReactNode;
}

/**
 * قسم إعدادات بعمودين (R3 «النماذج v2»): العنوان ووصف قصير في جهة البداية، والحقول في لوحة بحد في
 * الجهة الأخرى. تحت 64rem يصير عمودًا واحدًا: العنوان فوق لوحته.
 */
export function SettingsSection({
  title,
  description,
  aside,
  id,
  tone = "default",
  testId,
  children,
}: SettingsSectionProps) {
  const headingId = id === undefined ? undefined : `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-testid={testId}
      className={cx(styles.section, tone !== "default" && styles[tone])}
    >
      <div className={styles.intro}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {description === undefined ? null : <p className={styles.description}>{description}</p>}
        {aside}
      </div>
      <div className={styles.panel}>{children}</div>
    </section>
  );
}

/** أسفل لوحة القسم: الأفعال على خط شعري، بلا شريط حفظ (للنماذج القصيرة وصفحات التأكيد). */
export function PanelFooter({ children }: { readonly children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}

/** مجموعة أقسام بإيقاع واحد وخط شعري بينها. */
export function SettingsStack({ children }: { readonly children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

interface DisclosureProps {
  readonly summary: string;
  readonly children: ReactNode;
  readonly testId?: string;
}

/**
 * «ما الذي يترتب؟»: الشرح الطويل مطويًّا تحت الحقل بدل جدار نص. `<details>` أصلي: يعمل بلا JavaScript
 * ويُقرأ لقارئ الشاشة، والملخص زر بأيقونة.
 */
export function Disclosure({ summary, children, testId }: DisclosureProps) {
  return (
    <details className={styles.disclosure} data-testid={testId}>
      <summary className={styles.summary}>
        <AdminIcon name="info" />
        <span>{summary}</span>
      </summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}

/** قائمة قصيرة داخل `Disclosure`: كل سطر نتيجة واحدة. */
export function PointList({ lines }: { readonly lines: readonly string[] }) {
  return (
    <ul className={styles.points}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
