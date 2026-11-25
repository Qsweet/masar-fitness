import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./button.module.css";

export type ButtonVariant = "ink" | "yellow" | "line";

interface ButtonLinkProps {
  readonly href: string;
  readonly variant?: ButtonVariant;
  /** رابط خارج الموقع (واتساب، الخرائط، الهاتف): وسم a عادي بلا توجيه داخلي. */
  readonly external?: boolean;
  /** بعرض الحاوية كاملًا */
  readonly block?: boolean;
  readonly children: ReactNode;
}

/** يُرجع أصناف الزر لاستعمالها على عنصر آخر (زر حقيقي مثلًا). */
export function buttonClass(variant: ButtonVariant, block = false): string {
  return cx(styles.button, styles[variant], block && styles.block);
}

export function ButtonLink({
  href,
  variant = "ink",
  external = false,
  block = false,
  children,
}: ButtonLinkProps) {
  const className = buttonClass(variant, block);
  if (external) {
    const isWeb = href.startsWith("https://");
    return (
      <a href={href} rel={isWeb ? "noopener noreferrer" : undefined} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
