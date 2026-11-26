import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ADMIN_MAIN_ID } from "@/components/admin/admin-shell";
import { ADMIN_DEFAULT_LOCALE, adminDirection, getAdminDictionary } from "@/i18n/admin";
import { alexandria } from "../fonts";
import "../globals.css";
import "../patterns.css";

/**
 * التخطيط الجذري للوحة التحكم، خارج ‎[locale]‎ (docs/ADMIN_DESIGN.md §4.8): عربية RTL بقاموسها الخاص
 * ورموز الهوية نفسها. كل صفحة تُعرض عند الطلب (جلسة وnonce)، ولا تُفهرس أبدًا: الوسم هنا، وترويسة
 * X-Robots-Tag و Cache-Control: no-store من proxy.ts.
 */
export const dynamic = "force-dynamic";

// لون شريط المتصفح على الجوال: أسود اللوحة (--ink في globals.css)
export const viewport: Viewport = { themeColor: "#0a0a0a" };

export function generateMetadata(): Metadata {
  const { meta } = getAdminDictionary();
  return {
    title: { default: meta.title, template: meta.titleTemplate },
    robots: { index: false, follow: false },
  };
}

export default function AdminRootLayout({ children }: { readonly children: ReactNode }) {
  const dictionary = getAdminDictionary();
  return (
    <html lang={ADMIN_DEFAULT_LOCALE} dir={adminDirection()} className={alexandria.variable}>
      <body>
        <a href={`#${ADMIN_MAIN_ID}`} className="skip-link">
          {dictionary.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
