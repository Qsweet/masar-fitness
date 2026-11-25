"use client";

import { useEffect, useState, type ReactNode } from "react";

interface StickyRevealProps {
  /** معرّف العنصر الذي يُخفي الشريط ما دام ظاهرًا أو تحت الشاشة (فعلا الواجهة، أو رأس الصفحة). */
  readonly afterId: string;
  readonly className: string | undefined;
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * شريط شراء يظهر بعد أن يتجاوز الزائر عنصرًا (فعلَي الواجهة أو رأس الصفحة)، حتى لا يكرر زره أو يغطيه.
 * بلا JavaScript يبقى مخفيًا، والواجهة وقسم الاشتراكات كافيان للشراء.
 */
export function StickyReveal({ afterId, className, label, children }: StickyRevealProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(afterId);
    if (target === null) {
      return undefined;
    }
    // ظاهر حين يصير العنصر فوق الشاشة (تجاوزه الزائر بالتمرير)، لا حين يكون تحتها بعد.
    // يُقاس بأعلى العنصر لا بأسفله: عند لحظة الخروج قد يبقى أسفله كسرَ بكسل داخل الشاشة.
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < 0);
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
