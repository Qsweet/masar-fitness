import Image from "next/image";
import logo from "@/assets/brand/logo.png";

interface LogoProps {
  /** الارتفاع المعروض بالبكسل، لاختيار حجم الصورة المناسب */
  readonly height: number;
  /** نص بديل؛ فارغ حين يكرر الشعار نصًا مجاورًا */
  readonly alt: string;
  readonly preload?: boolean;
}

/** الشعار الأصلي كما هو (أبيض وكهرماني لخلفية داكنة): لا تلوين ولا قص ولا تمديد. */
export function Logo({ height, alt, preload = false }: LogoProps) {
  return (
    <Image
      src={logo}
      alt={alt}
      sizes={`${String(Math.ceil((height * logo.width) / logo.height))}px`}
      preload={preload}
      style={{ height, width: "auto" }}
    />
  );
}
