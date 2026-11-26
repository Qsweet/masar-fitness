"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./kit";

interface SubmitButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly block?: boolean;
  /** اسم الزر لقارئ الشاشة حين لا يكفي نصه (زر في صف جدول). */
  readonly label?: string;
  readonly children: ReactNode;
}

/**
 * زر إرسال لنموذج بإجراء خادم مباشر (خروج، إلغاء جلسة…): أثناء الانتظار يتعطل ويظهر مؤشر دوّار،
 * بالعرض والنص نفسيهما فلا يتحرك التخطيط. بلا JavaScript زر إرسال عادي.
 */
export function SubmitButton({ variant, size, block, label, children }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-pending={pending}
      aria-label={label}
      className={buttonClass({
        ...(variant === undefined ? {} : { variant }),
        ...(size === undefined ? {} : { size }),
        ...(block === undefined ? {} : { block }),
      })}
    >
      {children}
    </button>
  );
}
