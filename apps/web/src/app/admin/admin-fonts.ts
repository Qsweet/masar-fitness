import localFont from "next/font/local";
import { fontVariables } from "../fonts";

/*
 * خط نص اللوحة وحدها (القرار 91): IBM Plex Sans Arabic بأوزانه الثلاثة المستعملة، للتسميات والجداول
 * والتلميحات والنص الكثيف حيث Alexandria العريض يتعب العين بأحجام 12–15px. العناوين والأرقام الكبيرة
 * تبقى Alexandria (هوية النادي)، والحروف اللاتينية والأرقام في كل مكان تبقى وجه Alexandria اللاتيني
 * (أول القائمة بمداه). الموقع العام لا يحمّله. ملف المدى العربي من Fontsource كما هو (رخصة OFL، النص في
 * assets/fonts)، وبديل مقيس يمنع الانزياح عند التحميل.
 *
 * في وحدة خاصة باللوحة لا في fonts.ts: next/font يحمّل مسبقًا كل خط في رسم وحدات الصفحة، وfonts.ts يستورده
 * الموقع العام (القرار 91، ويحرسه admin-fonts.test.ts).
 */
export const plexArabic = localFont({
  src: [
    { path: "../../assets/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400" },
    { path: "../../assets/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500" },
    { path: "../../assets/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600" },
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
