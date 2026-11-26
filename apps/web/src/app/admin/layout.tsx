import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ADMIN_MAIN_ID } from "@/components/admin/main-id";
import { ADMIN_THEME_COOKIE, parseAdminTheme } from "@/config/admin";
import { ADMIN_DEFAULT_LOCALE, adminDirection, getAdminDictionary } from "@/i18n/admin";
import { alexandria } from "../fonts";
import "../globals.css";
import "../patterns.css";
import "./admin.css";

/**
 * التخطيط الجذري للوحة التحكم، خارج ‎[locale]‎ (docs/ADMIN_DESIGN.md §4.8): عربية RTL بقاموسها الخاص
 * ورموزها (‎admin.css‎ فوق رموز الهوية). المظهر (داكن افتراضيًا أو فاتح) من كوكي التفضيل، يُكتب على
 * وسم html من الخادم فلا وميض. كل صفحة تُعرض عند الطلب (جلسة وnonce)، ولا تُفهرس أبدًا: الوسم هنا،
 * وترويسة X-Robots-Tag و Cache-Control: no-store من proxy.ts. لا جلسة ولا بيانات تُقرأ هنا.
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

export default async function AdminRootLayout({ children }: { readonly children: ReactNode }) {
  const dictionary = getAdminDictionary();
  const theme = parseAdminTheme((await cookies()).get(ADMIN_THEME_COOKIE)?.value);
  return (
    <html
      lang={ADMIN_DEFAULT_LOCALE}
      dir={adminDirection()}
      className={alexandria.variable}
      data-admin=""
      data-theme={theme}
    >
      <body>
        <a href={`#${ADMIN_MAIN_ID}`} className="skip-link">
          {dictionary.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
