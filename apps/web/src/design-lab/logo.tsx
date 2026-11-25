import Image from "next/image";
import logo from "@/assets/brand/logo.png";

interface LogoProps {
  readonly className?: string;
  /** الارتفاع المعروض بالبكسل، لاختيار حجم الصورة المناسب */
  readonly height: number;
  readonly preload?: boolean;
}

/** الشعار الأصلي كما هو (أبيض وكهرماني لخلفية داكنة): لا تلوين ولا قص ولا تمديد. */
export function Logo({ className = "", height, preload = false }: LogoProps) {
  return (
    <Image
      src={logo}
      alt="شعار نادي مسار الأبطال الرياضي"
      sizes={`${String(Math.ceil((height * logo.width) / logo.height))}px`}
      preload={preload}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
