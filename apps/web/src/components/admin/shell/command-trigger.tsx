"use client";

import type { ReactNode } from "react";
import { COMMAND_EVENT, type ShellCommand } from "./attributes";

interface CommandTriggerProps {
  readonly command: ShellCommand;
  /** وجهة الرابط بلا JavaScript (صفحة البحث، أو قسم الاختصارات فيها). */
  readonly href: string;
  readonly className: string | undefined;
  readonly label?: string;
  readonly children: ReactNode;
}

/**
 * زر يفتح لوحة الأوامر أو حوار الاختصارات. رابط حقيقي في أصله، فبلا JavaScript يفتح صفحة البحث التي
 * تعمل وحدها؛ ومع JavaScript يفتح الحوار في مكانه (ADMIN_REDESIGN §4.3، قبول R1).
 */
export function CommandTrigger({ command, href, className, label, children }: CommandTriggerProps) {
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      aria-haspopup="dialog"
      onClick={(event) => {
        // تبويب جديد أو نافذة بمفتاح تعديل أو زر آخر: يبقى رابطًا كما يتوقع المستخدم
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        window.dispatchEvent(new CustomEvent<ShellCommand>(COMMAND_EVENT, { detail: command }));
      }}
    >
      {children}
    </a>
  );
}
