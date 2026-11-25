import localFont from "next/font/local";

/*
 * خط واحد مستضاف ذاتيًا (رخصة OFL، النص في assets/fonts): لا طلب لطرف ثالث، ولا انزياح عند التحميل.
 * Alexandria للنص والعناوين والأرقام (هندسي عريض، الأقرب لكتابة الشعار، وأرقامه اللاتينية واضحة).
 */
export const alexandria = localFont({
  src: [
    { path: "../assets/fonts/alexandria-arabic-wght-normal.woff2", weight: "100 900" },
    { path: "../assets/fonts/alexandria-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--font-alexandria",
  display: "swap",
});
