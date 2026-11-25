import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { plexArabic } from "@/design-lab/fonts";
import "@/design-lab/lab.css";

/**
 * مختبر التصميم: تخطيط جذري مستقل عن الموقع (لا ترويسة ولا قواميس ولا أنماط الإنتاج).
 * مغلق عن محركات البحث دائمًا، حتى لو فُتحت فهرسة الموقع لاحقًا.
 */
export const metadata: Metadata = {
  title: { default: "مختبر التصميم | مسار الأبطال", template: "%s | مختبر التصميم" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#0c1014" };

// الأسعار من القاعدة عند كل طلب، وسياسة أمان المحتوى بـnonce لكل طلب
export const dynamic = "force-dynamic";

export default function DesignLabLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plexArabic.variable}>
      <body>{children}</body>
    </html>
  );
}
