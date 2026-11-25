"use client";

import { useEffect, useState, type ReactNode } from "react";

interface StickyRevealProps {
  /** معرّف العنصر الذي يُخفي الشريط ما دام ظاهرًا (عادةً الواجهة). */
  readonly afterId: string;
  readonly className: string | undefined;
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * شريط شراء يظهر بعد أن تغادر الواجهة الشاشة، حتى لا يكرر زرها أو يغطيه.
 * بلا JavaScript يبقى مخفيًا، والواجهة وقسم الاشتراكات كافيان للشراء.
 */
export function StickyReveal({ afterId, className, label, children }: StickyRevealProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(afterId);
    if (target === null) {
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry !== undefined && !entry.isIntersecting);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [afterId]);

  return (
    <aside aria-label={label} className={className} hidden={!visible} data-sticky-bar>
      {children}
    </aside>
  );
}
