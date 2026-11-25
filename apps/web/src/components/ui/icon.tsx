import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./icon.module.css";

/**
 * أيقونات خطية مرسومة هنا (شبكة 24، خط 2 بلون النص)، بلا مكتبة ولا ملفات. زخرفية دائمًا (aria-hidden):
 * المعنى في النص المجاور. ما يدل على اتجاه (السهم) ينعكس تلقائيًا مع الكتابة من اليمين.
 */
const PATHS = {
  dumbbell: (
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .8 3.2 2.6 3.5 5.2" />
    </>
  ),
  waves: (
    <>
      <path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 18c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" />
    </>
  ),
  flame: (
    <>
      <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.6 3.8-8.8.4 1.9 1.4 3 2.6 3.6.2-2.4 1.3-4.6 3.1-6.1-.2 3 1.2 4.8 2.4 6.6.7 1.1 1.1 2.4 1.1 4.1 0 4-2.7 6.8-6.5 6.8Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  phone: (
    <path d="M5 3.5h3.5l1.8 4.6-2.3 1.4a11 11 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8V19a2 2 0 0 1-2 2C10.6 21 3 13.4 3 5.5a2 2 0 0 1 2-2Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  chat: <path d="M4 19.5 5.3 16A8 8 0 1 1 8 18.7Z M8.5 10.5h7M8.5 13.5h4.5" />,
  award: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.7 13.4-1.7 7.1 5-2.6 5 2.6-1.7-7.1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6Z" />
      <path d="m8.8 12 2.3 2.3 4.2-4.3" />
    </>
  ),
  snowflake: (
    <path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20ZM7.5 12h2.5l1.2-2.2 1.8 4.2 1.2-2h2.3" />
  ),
  person: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21c.4-4.3 3.2-7 7-7s6.6 2.7 7 7" />
    </>
  ),
  sparkle: (
    <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7ZM19 16.5c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2Z" />
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".6" />
    </>
  ),
  x: <path d="M4.5 4h4.2l10.8 16h-4.2ZM19.5 4l-6.3 7M4.5 20l6.3-7" />,
  snapchat: (
    <path d="M12 3.5c3 0 5 2.2 5 5.2v2.2l1.8-.5c.6.6.3 1.3-.4 1.6l-1.5.6c.5 1.9 1.9 3.3 3.6 3.8-.4.8-1.4 1.1-2.6 1.2l-.3 1.3c-1-.2-2.1-.2-3 .3-.8.5-1.6 1.3-2.6 1.3s-1.8-.8-2.6-1.3c-.9-.5-2-.5-3-.3l-.3-1.3c-1.2-.1-2.2-.4-2.6-1.2 1.7-.5 3.1-1.9 3.6-3.8l-1.5-.6c-.7-.3-1-1-.4-1.6l1.8.5V8.7c0-3 2-5.2 5-5.2Z" />
  ),
  tiktok: <path d="M14 3.5v11.2a3.8 3.8 0 1 1-3.8-3.8M14 3.5c.4 2.6 2.3 4.4 5 4.6" />,
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface IconProps {
  readonly name: IconName;
  readonly className?: string | undefined;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx(styles.icon, name === "arrow" && styles.directional, className)}
    >
      {PATHS[name]}
    </svg>
  );
}

/** مربع مستدير بالتدرّج وأيقونة بالحبر داخله (رقائق الإحصاءات والمزايا). */
export function IconTile({ name, className }: IconProps) {
  return (
    <span className={cx(styles.tile, className)} aria-hidden="true">
      <Icon name={name} />
    </span>
  );
}
