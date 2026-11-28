import type { ComponentProps, ReactNode } from "react";
import { AdminIcon } from "../admin-icon";
import styles from "./toolbar.module.css";

type InputProps = Omit<ComponentProps<"input">, "className" | "id">;

interface ToolbarSearchProps extends InputProps {
  readonly id: string;
  /** اسم الحقل لقارئ الشاشة؛ المعنى ظاهر في العنصر النائب والأيقونة. */
  readonly label: string;
}

/** حقل بحث في شريط أدوات الجدول: أيقونة، واسم لقارئ الشاشة، والمعنى في العنصر النائب. */
export function ToolbarSearch({ id, label, ...input }: ToolbarSearchProps) {
  return (
    <div className={styles.search}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <AdminIcon name="search" size={16} className={styles.searchIcon} />
      <input id={id} type="search" className={styles.searchInput} {...input} />
    </div>
  );
}

interface ToolbarFieldProps {
  readonly id: string;
  readonly label: string;
  readonly children: ReactNode;
}

/** حقل قصير في شريط الأدوات: تسمية مرئية قصيرة في سطره («من»، «النوع») ثم العنصر. */
export function ToolbarField({ id, label, children }: ToolbarFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.prefix}>
        {label}
      </label>
      {children}
    </div>
  );
}

export { styles as toolbarStyles };
