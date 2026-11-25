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
 * ويُخفى أثناء الكتابة في حقل. بلا JavaScript يبقى مخفيًا، والواجهة وقسم الاشتراكات كافيان للشراء.
 */
/** حقول الكتابة: حين يكتب الزائر في نموذج (التواصل مثلًا) يُخفى الشريط حتى لا يغطي الحقل أو يعلو لوحة المفاتيح. */
const TYPING_SELECTOR = "input:not([type=radio], [type=checkbox]), textarea, select";

function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const update = () => {
      setTyping(document.activeElement?.matches(TYPING_SELECTOR) ?? false);
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  return typing;
}

export function StickyReveal({ afterId, className, label, children }: StickyRevealProps) {
  const [passed, setPassed] = useState(false);
  const typing = useTyping();

  useEffect(() => {
    const target = document.getElementById(afterId);
    if (target === null) {
      return undefined;
    }
    // ظاهر حين يصير العنصر فوق الشاشة (تجاوزه الزائر بالتمرير)، لا حين يكون تحتها بعد.
    // يُقاس بأعلى العنصر لا بأسفله: عند لحظة الخروج قد يبقى أسفله كسرَ بكسل داخل الشاشة.
    const observer = new IntersectionObserver(([entry]) => {
      setPassed(entry !== undefined && !entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [afterId]);

  return (
    <aside aria-label={label} className={className} hidden={!passed || typing} data-sticky-bar>
      {children}
    </aside>
  );
}
