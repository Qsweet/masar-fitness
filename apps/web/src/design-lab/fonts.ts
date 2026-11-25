import localFont from "next/font/local";

/*
 * خطوط المختبر، مستضافة ذاتيًا (رخصة OFL، النصوص بجانب الملفات). كل مفهوم يحمّل ما يستعمله فقط.
 * Alexandria: هندسي عريض، الأقرب لكتابة الشعار. IBM Plex Sans Arabic: دقيق ومقروء للمتجر.
 * Changa: مضغوط رياضي للعناوين الكبيرة.
 */
export const alexandria = localFont({
  src: [
    { path: "../assets/fonts/alexandria-arabic-wght-normal.woff2", weight: "100 900" },
    { path: "../assets/fonts/alexandria-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--lab-alexandria",
  display: "swap",
});

export const plexArabic = localFont({
  src: [
    { path: "./fonts/plex-arabic-arabic-300.woff2", weight: "300" },
    { path: "./fonts/plex-arabic-latin-300.woff2", weight: "300" },
    { path: "./fonts/plex-arabic-arabic-400.woff2", weight: "400" },
    { path: "./fonts/plex-arabic-latin-400.woff2", weight: "400" },
    { path: "./fonts/plex-arabic-arabic-500.woff2", weight: "500" },
    { path: "./fonts/plex-arabic-latin-500.woff2", weight: "500" },
    { path: "./fonts/plex-arabic-arabic-600.woff2", weight: "600" },
    { path: "./fonts/plex-arabic-latin-600.woff2", weight: "600" },
    { path: "./fonts/plex-arabic-arabic-700.woff2", weight: "700" },
    { path: "./fonts/plex-arabic-latin-700.woff2", weight: "700" },
  ],
  variable: "--lab-plex",
  display: "swap",
});

export const changa = localFont({
  src: [
    { path: "./fonts/changa-arabic.woff2", weight: "200 800" },
    { path: "./fonts/changa-latin.woff2", weight: "200 800" },
  ],
  variable: "--lab-changa",
  display: "swap",
});
