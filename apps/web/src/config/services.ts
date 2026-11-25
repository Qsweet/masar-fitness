/**
 * الخدمات والبرامج بأسعارها كما يعرضها موقع النادي الحالي (docs/CLUB_FACTS.md §4، قراءة 2026-11-25).
 * مؤقتة حتى يؤكدها المالك، وغير قابلة للشراء من الموقع بعد: الطلب عبر واتساب. المبالغ بالهللة.
 * التدريب الشخصي: المجموعة الجديدة المربوطة من الرئيسية فقط (§4.3)، لا الباقات الأقدم المتعارضة معها (§13).
 * التأهيل: باقات الصفحات الجديدة (§4.4) التي تنص أنها ليست علاجًا طبيعيًا وتشترط موافقة طبية.
 * BE STRONG 45 ليس هنا ولا يُذكر: الموقع نفسه يقول إن شراءه وتفعيله «قيد الإعداد» (§4.6).
 */
export type ServiceId = "personalTraining" | "rehab" | "swimming";

export interface ServicePackage {
  readonly sessions: number;
  readonly priceMinor: number;
}

export interface ServiceOffer {
  readonly id: ServiceId;
  /** وحدة العدّ في القاموس: حصص التدريب أو جلسات التأهيل والسباحة */
  readonly unit: "session" | "sitting";
  readonly packages: readonly [ServicePackage, ...ServicePackage[]];
  /**
   * أقل سعر هنا هو فعلًا أقل سعر في موقع النادي، فتصح عبارة «من … ر.س». التدريب الشخصي لا: الموقع يعرض
   * معه مجموعة أقدم أرخص (6 + 2 مجانًا بـ675، §13 البند 8) لم يُحسم أيهما الحالي.
   */
  readonly lowestConfirmed: boolean;
}

export const SERVICES: readonly ServiceOffer[] = [
  {
    id: "personalTraining",
    unit: "session",
    lowestConfirmed: false,
    packages: [
      { sessions: 8, priceMinor: 99_000 },
      { sessions: 12, priceMinor: 142_800 },
      { sessions: 24, priceMinor: 268_800 },
      { sessions: 30, priceMinor: 299_900 },
    ],
  },
  {
    id: "rehab",
    unit: "sitting",
    lowestConfirmed: true,
    packages: [
      { sessions: 6, priceMinor: 72_000 },
      { sessions: 12, priceMinor: 132_000 },
      { sessions: 18, priceMinor: 189_000 },
      { sessions: 24, priceMinor: 240_000 },
    ],
  },
  {
    id: "swimming",
    unit: "sitting",
    lowestConfirmed: true,
    packages: [
      { sessions: 6, priceMinor: 69_000 },
      { sessions: 12, priceMinor: 115_000 },
      { sessions: 18, priceMinor: 199_000 },
    ],
  },
];

/**
 * عرض الأصدقاء (§4.2): «عرض الأصدقاء لـ 3 أشخاص | 12 شهرًا + شهرين مجانًا لكل شخص» بـ3,999 ريالًا للثلاثة،
 * ويشترط اشتراكهم معًا. يُطلب عبر واتساب.
 */
export const FRIENDS_OFFER = {
  people: 3,
  paidMonths: 12,
  bonusMonths: 2,
  priceMinor: 399_900,
} as const;
