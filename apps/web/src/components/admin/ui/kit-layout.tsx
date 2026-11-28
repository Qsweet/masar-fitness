import type { ComponentProps, ReactNode } from "react";
import { uiStyles as styles } from "./ui-styles";

/** عدّة اللوحة: التخطيطات والقوائم المعروضة (تُصدَّر أيضًا من kit.tsx). */
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
