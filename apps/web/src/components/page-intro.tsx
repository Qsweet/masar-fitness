import type { ReactNode } from "react";
import styles from "./page-intro.module.css";

interface PageIntroProps {
  readonly title: string;
  readonly lead: string;
  /** عنصر فوق العنوان، مثل رابط الرجوع. */
  readonly before?: ReactNode;
  /** عناصر بعد السطر التعريفي، مثل تواريخ المقال ومراجعه. */
  readonly children?: ReactNode;
}

/** معرّف رأس الصفحة: شريط الشراء الثابت يظهر بعد أن يغادر الشاشة. */
export const INTRO_ID = "top";

/** رأس الصفحات الداخلية: عنوان بحجم ملصق وسطر واحد، وما يليه مباشرة هو الاختيار والسعر. */
export function PageIntro({ title, lead, before, children }: PageIntroProps) {
  return (
    <section id={INTRO_ID} className={styles.intro}>
      <div className="container">
        {before === undefined ? null : <div className={styles.before}>{before}</div>}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        {children}
      </div>
    </section>
  );
}
