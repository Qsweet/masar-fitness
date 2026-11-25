/**
 * حقائق النادي المعروضة في الموقع، منقولة كما هي من موقعه الحالي (docs/CLUB_FACTS.md، قراءة 2026-11-25).
 * مؤقتة حتى يؤكدها المالك؛ كل قيمة بجانبها قسمها في السجل. لا رقم هنا لم يرد في الموقع الحالي.
 */
export const CLUB_FACTS = {
  /** «تأسس مركز مسار الأبطال عام 2018» (§1، من نحن) */
  foundedYear: 2018,
  /** «تضم صالة الحديد أكثر من 60 جهازًا متنوعًا» (§3، الرئيسية) */
  machinesOver: 60,
  /** «متدرج العمق من 1.5 متر حتى 3.5 متر» (§3، الرئيسية) */
  poolDepthMeters: { min: "1.5", max: "3.5" },
  /** «خدمات النادي للرجال من عمر 18 عاماً فأكثر» (§7، سياسة الخصوصية) */
  minimumAge: 18,
  /** «5 أيام لكل شهر مدفوع» (§7، صفحات الاشتراكات والشروط) */
  freezeDaysPerPaidMonth: 5,
  /** «السجل التجاري 7003597346» بالتسمية نفسها في شارة التذييل (§1) */
  commercialRegistration: "7003597346",
  /** البريد الظاهر في الترويسة والتذييل (§1) */
  email: "Mmastersway@gmail.com",
} as const;

/**
 * تقييم Google كما عرضه نص الرئيسية يوم القراءة: «★ 4.5» و«1,841 تقييم على Google» (§10).
 * رقم متغير مأخوذ من موقع النادي لا من Google مباشرة؛ يُعرض دائمًا مع مصدره وتاريخه.
 */
export const GOOGLE_RATING = {
  /** بالأعشار لتبقى عددًا صحيحًا: 45 = 4.5 */
  tenths: 45,
  outOf: 5,
  count: 1841,
  /** تاريخ القراءة (ISO) */
  readOn: "2026-11-25",
} as const;

/** الحسابات الاجتماعية بروابط التذييل نفسها (§1). الترتيب ترتيب العرض. */
export const SOCIAL_LINKS = [
  { id: "instagram", url: "https://www.instagram.com/Mmastersway" },
  { id: "x", url: "https://x.com/mmastersway" },
  { id: "snapchat", url: "https://www.snapchat.com/add/Mmastersway" },
  { id: "tiktok", url: "https://www.tiktok.com/@Mmastersway" },
] as const;

export type SocialId = (typeof SOCIAL_LINKS)[number]["id"];
