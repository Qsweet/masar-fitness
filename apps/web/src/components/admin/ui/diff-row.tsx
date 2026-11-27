import type { ReactNode } from "react";
import styles from "./diff-row.module.css";

interface DiffRowProps {
  /** ما يعرّف السطر (المسار وشاراته). */
  readonly head: ReactNode;
  readonly beforeLabel: string;
  readonly afterLabel: string;
  readonly before: string;
  readonly after: string;
  readonly dir: "rtl" | "ltr";
  readonly lang: string;
}

/**
 * سطر فرق: القديم والجديد متجاوران (فوق بعضهما على الهاتف)، لا فرق حرفيًا. القديم مشطوب بصريًا
 * بلون الخطر والجديد بلون النجاح، والتسمية نصًّا لا لونًا وحده.
 */
export function DiffRow({ head, beforeLabel, afterLabel, before, after, dir, lang }: DiffRowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.head}>{head}</div>
      <div className={styles.pair}>
        <div className={styles.before}>
          <span className={styles.label}>{beforeLabel}</span>
          <p dir={dir} lang={lang}>
            {before}
          </p>
        </div>
        <div className={styles.after}>
          <span className={styles.label}>{afterLabel}</span>
          <p dir={dir} lang={lang}>
            {after}
          </p>
        </div>
      </div>
    </li>
  );
}
