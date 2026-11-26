"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { MENU_ATTRIBUTE } from "./attributes";

function openMenus(): HTMLDetailsElement[] {
  return Array.from(
    document.querySelectorAll<HTMLDetailsElement>(`details[${MENU_ATTRIBUTE}][open]`),
  );
}

/**
 * إغلاق قوائم ‎<details>‎ كما يُتوقع من قائمة: بـEsc (ويعود التركيز إلى زرها)، وبالضغط خارجها، وبعد
 * التنقل. القائمة نفسها ‎<details>‎ تعمل بلا JavaScript؛ هذا المكوّن تحسين فوقها ولا يرسم شيئًا.
 */
export function MenuDismiss() {
  const pathname = usePathname();
  useEffect(() => {
    for (const menu of openMenus()) {
      menu.open = false;
    }
  }, [pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      for (const menu of openMenus()) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    const onPointer = (event: PointerEvent): void => {
      for (const menu of openMenus()) {
        if (event.target instanceof Node && !menu.contains(event.target)) {
          menu.open = false;
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  return null;
}
