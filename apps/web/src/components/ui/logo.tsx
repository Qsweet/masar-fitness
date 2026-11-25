import Image from "next/image";
import lockup from "@/assets/brand/logo-lockup.svg";
import stacked from "@/assets/brand/logo.svg";

/**
 * الشعار الرسمي متجهًا (أبيض وأصفر لخلفية سوداء): الكامل كما رُسم، والأفقي من عناصره نفسها للترويسة
 * (الرمز وMASTERS WAY بلا السطر العربي الذي لا يُقرأ في ارتفاع الترويسة).
 */
const ART = { stacked, lockup } as const;

interface LogoProps {
  readonly variant: keyof typeof ART;
  /** ارتفاع من رموز التصميم (مثل ‎var(--logo-height)‎) */
  readonly height: string;
  /** نص بديل من القاموس؛ فارغ حين يكرر الشعار نصًا مجاورًا */
  readonly alt: string;
  readonly preload?: boolean;
}

/** الشعار الرسمي بلا تلوين ولا قص ولا تمديد؛ ملف SVG يُقدَّم كما هو بلا تحسين صور. */
export function Logo({ variant, height, alt, preload = false }: LogoProps) {
  const art = ART[variant];
  return (
    <Image src={art} alt={alt} preload={preload} unoptimized style={{ height, width: "auto" }} />
  );
}
