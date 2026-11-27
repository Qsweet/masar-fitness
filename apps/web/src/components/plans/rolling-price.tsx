"use client";

import { useEffect, useRef } from "react";
import type { MoneyParts } from "@/i18n/format";
import { cx } from "@/lib/cx";
import styles from "./rolling-price.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const DIGIT = /^\d$/;
/** مدة دوران الخانة الأخيرة، وما تزيده كل خانة نحو الآحاد (عدّاد يستقر من اليسار إلى اليمين). */
const ROLL_MS = 720;
const STAGGER_MS = 90;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** الشريط الأرقام 0–9 مرتين: كل رقم جزء من عشرين من ارتفاعه، والسعر يقف في الدورة الثانية. */
const STEP_PERCENT = 5;
const CYCLE = 10;

interface Cell {
  readonly char: string;
  /** الرقم الذي يبدأ منه الدوران في هذه الخانة: رقم السعر السابق في موضعه، أو 0 لخانة جديدة. */
  readonly from: number;
}

/** خانات المبلغ محاذاة من اليمين مع المبلغ السابق (الآحاد مع الآحاد)، فالدوران من الرقم المقابل. */
function cellsOf(amount: string, previous: string | undefined): Cell[] {
  const chars = Array.from(amount);
  const before = Array.from(previous ?? "");
  const offset = before.length - chars.length;
  return chars.map((char, index) => {
    const prior = before[index + offset];
    return { char, from: prior !== undefined && DIGIT.test(prior) ? Number(prior) : 0 };
  });
}

function rollCells(root: HTMLElement): void {
  const cells = [...root.querySelectorAll<HTMLElement>("[data-digit]")];
  cells.forEach((cell, index) => {
    const from = Number(cell.dataset.from);
    const to = Number(cell.dataset.digit);
    cell.animate(
      [
        { translate: `0 ${String(-from * STEP_PERCENT)}%` },
        { translate: `0 ${String(-(to + CYCLE) * STEP_PERCENT)}%` },
      ],
      { duration: ROLL_MS + index * STAGGER_MS, easing: EASE, pseudoElement: "::before" },
    );
  });
}

interface RollingPriceProps {
  readonly parts: MoneyParts;
  /** المبلغ المعروض قبل تغيير الاختيار؛ غائب أول مرة فلا دوران. */
  readonly from: string | undefined;
  /** الدوران حين يصير هذا السعر هو الظاهر فقط. */
  readonly active: boolean;
  readonly className?: string | undefined;
  readonly unitClassName?: string | undefined;
}

/**
 * السعر الكبير بعدّاد دوّار: كل رقم شريط 0–9 مرتين مرسوم في CSS (`::before`) يقف عند رقمه، فيظهر
 * صحيحًا بلا JavaScript. حين يُختار اشتراك آخر تدور كل خانة دورة كاملة من رقم السعر السابق إلى رقمها
 * (Web Animations)، ولا حركة مع تقليل الحركة. المبلغ نصًا واحدًا لقارئ الشاشة، والأشرطة مخفية عنه.
 * الأرقام والفاصلة من الخادم (moneyParts)؛ لا حساب هنا.
 */
export function RollingPrice({ parts, from, active, className, unitClassName }: RollingPriceProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!active || from === undefined || from === parts.amount || root === null) {
      return;
    }
    if (!window.matchMedia(REDUCED_MOTION).matches) {
      rollCells(root);
    }
  }, [active, from, parts.amount]);
  return (
    <span className={cx(styles.price, className)}>
      <bdi className={styles.amount}>
        <span ref={ref} className={styles.cells} aria-hidden="true">
          {cellsOf(parts.amount, from).map((cell, index) =>
            DIGIT.test(cell.char) ? (
              <span
                key={index}
                className={styles.digit}
                data-digit={cell.char}
                data-from={cell.from}
              />
            ) : (
              <span key={index} className={styles.glyph} data-glyph={cell.char} />
            ),
          )}
        </span>
        <span className="sr-only">{parts.amount}</span>
      </bdi>{" "}
      <span className={unitClassName}>{parts.unit}</span>
    </span>
  );
}
