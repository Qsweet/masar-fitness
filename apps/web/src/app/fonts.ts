import localFont from "next/font/local";

/*
 * خطان مستضافان ذاتيًا (رخصة OFL، النصوص في assets/fonts): لا طلب لطرف ثالث، ولا انزياح عند التحميل.
 * Changa للعناوين والأرقام الكبيرة (مضغوط رياضي)، وAlexandria للنص (هندسي عريض، الأقرب لكتابة الشعار).
 */
export const changa = localFont({
  src: [
    { path: "../assets/fonts/changa-arabic-wght.woff2", weight: "200 800" },
    { path: "../assets/fonts/changa-latin-wght.woff2", weight: "200 800" },
  ],
  variable: "--font-changa",
  display: "swap",
});

export const alexandria = localFont({
  src: [
    { path: "../assets/fonts/alexandria-arabic-wght-normal.woff2", weight: "100 900" },
    { path: "../assets/fonts/alexandria-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--font-alexandria",
  display: "swap",
});
