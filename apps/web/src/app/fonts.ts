import localFont from "next/font/local";

/*
 * خط واحد مستضاف ذاتيًا (رخصة OFL، النص في assets/fonts): لا طلب لطرف ثالث، ولا انزياح عند التحميل.
 * Alexandria للنص والعناوين والأرقام (هندسي عريض، الأقرب لكتابة الشعار، وأرقامه اللاتينية واضحة).
 * ملفاه (العربي واللاتيني) وجهان بمدى حروف لكلٍّ (`unicode-range`، ADMIN_REDESIGN §3.3)، فالمتصفح لا
 * يحمّل اللاتيني لنص عربي خالص ولا العكس. القائمة في `--font` (globals.css): اللاتيني أولًا بلا بديل
 * مقيس (مداه لا يشمل العربية فلا يعترضها)، ثم العربي ومعه البديل المقيس الذي يمنع الانزياح. القيم
 * حرفية: محمّل الخطوط يرفض الثوابت. علامات الوصل والاتجاه (ZWJ وZWNJ وLRM/RLM والعزل) و‎U+FEFF‎
 * خارج مدى اللاتيني، فتُحل بالوجه العربي ولا تقطع تشكيل الكلمة العربية بين وجهين.
 */

export const alexandriaLatin = localFont({
  src: "../assets/fonts/alexandria-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-alexandria-latin",
  display: "swap",
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-200B, U+2010-2029, U+202F-2065, U+20AC, U+2122, U+2190-2193, U+2212, U+2215, U+2318, U+21B5, U+FFFD",
    },
  ],
});

export const alexandriaArabic = localFont({
  src: "../assets/fonts/alexandria-arabic-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-alexandria-arabic",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F, U+202A-202E, U+2066-2069, U+2E41",
    },
  ],
});

/** أصناف متغيري الخط لوسم html (الموقع العام واللوحة). */
export const fontVariables = `${alexandriaLatin.variable} ${alexandriaArabic.variable}`;

/*
 * خط نص اللوحة وحدها (القرار 91): IBM Plex Sans Arabic بأوزانه الثلاثة المستعملة، للتسميات والجداول
 * والتلميحات والنص الكثيف حيث Alexandria العريض يتعب العين بأحجام 12–15px. العناوين والأرقام الكبيرة
 * تبقى Alexandria (هوية النادي)، والحروف اللاتينية والأرقام في كل مكان تبقى وجه Alexandria اللاتيني
 * (أول القائمة بمداه). الموقع العام لا يحمّله. ملف المدى العربي من Fontsource كما هو (رخصة OFL، النص في
 * assets/fonts)، وبديل مقيس يمنع الانزياح عند التحميل.
 */
export const plexArabic = localFont({
  src: [
    { path: "../assets/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../assets/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500" },
    { path: "../assets/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F, U+202A-202E, U+2066-2069, U+2E41",
    },
  ],
});

/** متغيرات خطوط اللوحة: خطا الهوية وخط النص. */
export const adminFontVariables = `${fontVariables} ${plexArabic.variable}`;
