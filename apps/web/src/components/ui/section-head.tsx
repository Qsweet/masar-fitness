import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

interface SectionHeadProps {
  /** معرّف العنوان ليُسمّى به القسم (aria-labelledby) */
  readonly id: string;
  /** يُترك حين يقوله رأس الصفحة فوقه مباشرة، فلا يتكرر */
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly lead?: string | undefined;
  /** في البداية بدل الوسط (بجانب صورة) */
  readonly start?: boolean;
  readonly children?: ReactNode;
}

/** رأس قسم: سطر صغير بشرطة صفراء، ثم العنوان h2 ومضماره، ثم سطر شارح. */
export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
  start = false,
  children,
}: SectionHeadProps) {
  return (
    <div className={cx("section-head", start && "start")}>
      {eyebrow === undefined ? null : <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id} className="title-section">
        {title}
      </h2>
      {lead === undefined ? null : <p className="lead">{lead}</p>}
      {children}
    </div>
  );
}
