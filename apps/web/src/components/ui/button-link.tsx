import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary";

const BASE =
  "inline-flex min-h-12 items-center justify-center rounded-control px-6 text-body font-strong whitespace-nowrap no-underline transition-colors duration-(--duration-press)";

/** الأساسي كهرماني بحبر داكن (تباين 9:1) ويصلح على السطحين؛ الثانوي إطار بلون نص السطح. */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-lane-500 text-asphalt-950 hover:bg-lane-600",
  secondary: "border border-current hover:bg-(--band)",
};

interface ButtonLinkProps {
  readonly href: string;
  readonly variant?: Variant;
  /** رابط خارج الموقع (واتساب، الخرائط): وسم a عادي بلا توجيه داخلي. */
  readonly external?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  external = false,
  className = "",
  children,
}: ButtonLinkProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
