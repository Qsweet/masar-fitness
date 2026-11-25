/**
 * ساعات العمل كما يعرضها موقع النادي الحالي (docs/CLUB_FACTS.md §2، الرئيسية، قراءة 2026-11-25):
 * النادي «السبت – الخميس 6:00 ص – 2:00 ص»، «الجمعة 1:00 م – 12:00 ص»؛ والمسبح «السبت – الخميس 8:00 ص –
 * 11:30 م»، «الجمعة 3:00 م – 9:00 م». ساعات رمضان غير مذكورة فلا تُعرض. الوقت بصيغة 24 ساعة،
 * والإغلاق قبل الافتتاح يعني بعد منتصف الليل.
 */
export type DayGroup = "satThu" | "fri";

export interface OpeningSlot {
  readonly days: DayGroup;
  readonly opens: string;
  readonly closes: string;
}

export const CLUB_HOURS = {
  club: [
    { days: "satThu", opens: "06:00", closes: "02:00" },
    { days: "fri", opens: "13:00", closes: "00:00" },
  ],
  pool: [
    { days: "satThu", opens: "08:00", closes: "23:30" },
    { days: "fri", opens: "15:00", closes: "21:00" },
  ],
} as const satisfies Record<string, readonly OpeningSlot[]>;

export type HoursArea = keyof typeof CLUB_HOURS;

/** أيام كل مجموعة بأسماء schema.org (للبيانات المنظَّمة). */
export const DAY_GROUP_DAYS: Readonly<Record<DayGroup, readonly string[]>> = {
  satThu: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
  fri: ["Friday"],
};
