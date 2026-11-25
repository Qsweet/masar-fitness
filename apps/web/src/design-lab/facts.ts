import { CLUB_CONTACT, directionsUrl, whatsappUrl } from "@/config/club";

/**
 * حقائق مؤكدة فقط، ومصدر كل منها مذكور. المفاهيم الثلاثة تعرض هذه وحدها؛ لا تقييمات ولا إحصاءات ولا خصومات.
 */
export const CLUB_FACTS = {
  name: "مسار الأبطال الرياضي",
  nameLatin: "Masters Way",
  /** موقع النادي الحالي: «نادي رياضي رجالي في بريدة» */
  audience: "نادٍ رياضي للرجال",
  district: "حي الرحاب، بريدة",
  address: CLUB_CONTACT.address.ar,
  phone: CLUB_CONTACT.phoneDisplay,
  phoneHref: `tel:${CLUB_CONTACT.phoneE164}`,
  coordinates: `${CLUB_CONTACT.latitude}° N · ${CLUB_CONTACT.longitude}° E`,
  directions: directionsUrl(),
  whatsapp: whatsappUrl("مرحبًا، عندي استفسار عن الاشتراك في نادي مسار الأبطال."),
  /** شعارات مكتوبة على جدران النادي نفسه (ظاهرة في الصور) */
  wallSlogans: { arabic: "أنت قدها", strong: "BE STRONG", active: "BE ACTIVE" },
} as const;

export interface Facility {
  readonly name: string;
  readonly line: string;
}

/**
 * المرافق: موقع النادي الحالي يذكر الحديد والمسبح والجاكوزي والبخار؛ منطقة التمارين الوظيفية ظاهرة في الصور.
 * لا تُذكر الساونا (وردت في إعلان واحد ولم يؤكدها المالك).
 */
export const FACILITIES: readonly Facility[] = [
  { name: "صالة الحديد", line: "أجهزة وأوزان حرة لتمارين القوة" },
  { name: "التمارين الوظيفية", line: "صناديق القفز والحبال والأثقال الأولمبية" },
  { name: "المسبح", line: "مسبح داخلي بحارات للسباحة" },
  { name: "الجاكوزي", line: "للاسترخاء بعد التمرين" },
  { name: "البخار", line: "غرفة بخار للاستشفاء" },
];

/**
 * طرق الدفع التي يقبلها النادي اليوم (من تكامل الـCRM: مدى وApple Pay، تابي، تمارا، تحويل بنكي).
 * الدفع الإلكتروني على هذا الموقع لم يُبنَ بعد. التقسيط حسب موافقة المزوّد، ولا نعرض أي مبلغ قسط.
 */
export const PAYMENT_METHODS = [
  { name: "مدى", note: "بطاقة" },
  { name: "Apple Pay", note: "بضغطة" },
  { name: "تابي", note: "تقسيط حسب موافقة تابي" },
  { name: "تمارا", note: "تقسيط حسب موافقة تمارا" },
  { name: "تحويل بنكي", note: "عبر النادي" },
] as const;

export const PAYMENT_NOTE =
  "قيمة الأقساط وعددها يحددها مزوّد التقسيط عند الدفع، والموافقة حسب أهليتك.";

/** تنبيه ظاهر في كل مفهوم: الأسعار من قاعدة الموقع لكنها تجريبية حتى يدخل المالك أسعار النادي. */
export const DEMO_PRICE_NOTE = "الأسعار المعروضة تجريبية لغرض مراجعة التصميم.";
