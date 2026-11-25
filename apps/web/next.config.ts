import type { NextConfig } from "next";
import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales";

const HSTS_MAX_AGE_SECONDS = 63_072_000; // سنتان

/** ترويسات أمنية ثابتة لكل الردود. سياسة CSP تُضاف في المرحلة 2 (انظر docs/DECISIONS.md، القرار 9). */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: `max-age=${String(HSTS_MAX_AGE_SECONDS)}; includeSubDomains`,
  },
];

/** المقاطع الأولى التي لا تُعاد كتابتها إلى اللغة الافتراضية: اللغات نفسها والواجهات. */
const NON_REWRITTEN_PREFIXES = [...LOCALES, "api"].join("|");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // الحزم الداخلية تُصدَّر كمصدر TypeScript وتُترجَم هنا
  transpilePackages: ["@masar/db", "@masar/domain", "@masar/payments"],
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
  // رابط واحد معتمد لكل صفحة عربية: البادئة ‎/ar تُحوَّل تحويلًا دائمًا إلى الرابط بلا بادئة
  redirects() {
    return Promise.resolve([
      { source: `/${DEFAULT_LOCALE}`, destination: "/", permanent: true },
      { source: `/${DEFAULT_LOCALE}/:path*`, destination: "/:path*", permanent: true },
    ]);
  },
  // العربية تُخدَّم بلا بادئة: كل مسار لا يبدأ بلغة يُخدَّم داخليًا من ‎/ar/...‎ دون تغيير الرابط.
  // afterFiles: الملفات والمسارات الثابتة (robots.txt، الواجهات) تُطابَق أولًا.
  rewrites() {
    return Promise.resolve({
      beforeFiles: [],
      afterFiles: [
        { source: "/", destination: `/${DEFAULT_LOCALE}` },
        {
          source: `/:path((?!(?:${NON_REWRITTEN_PREFIXES})(?:/|$)).*)`,
          destination: `/${DEFAULT_LOCALE}/:path`,
        },
      ],
      fallback: [],
    });
  },
};

export default nextConfig;
