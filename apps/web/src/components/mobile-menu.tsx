"use client";

import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

interface MobileMenuProps {
  readonly label: string;
  readonly className: string | undefined;
  readonly children: ReactNode;
}

/**
 * قائمة الجوال: <details> أصلية تعمل بلا JavaScript، وهنا فقط إغلاقها عند اختيار رابط
 * (الانتقال داخل الصفحة لا يعيد إنشاءها فتبقى مفتوحة فوق المحتوى) وعند Escape مع إرجاع التركيز.
 */
export function MobileMenu({ label, className, children }: MobileMenuProps) {
  const menu = useRef<HTMLDetailsElement>(null);

  function close(): void {
    if (menu.current !== null) {
      menu.current.open = false;
    }
  }

  function onClick(event: MouseEvent<HTMLElement>): void {
    if (event.target instanceof Element && event.target.closest("a") !== null) {
      close();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "Escape" && menu.current?.open === true) {
      close();
      menu.current.querySelector("summary")?.focus();
    }
  }

  return (
    <details ref={menu} className={className} onClick={onClick} onKeyDown={onKeyDown}>
      <summary>{label}</summary>
      {children}
    </details>
  );
}
