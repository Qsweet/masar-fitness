/**
 * بيانات التواصل والموقع، منقولة من موقع النادي الحالي (mmastersway.com، قراءة بتاريخ 2026-11-24).
 * تُنقل إلى قاعدة البيانات مع لوحة الإدارة (المرحلة 5). أي تعديل هنا يؤكده المالك.
 */
export const CLUB_CONTACT = {
  phoneE164: "+966163240111",
  phoneDisplay: "016 324 0111",
  whatsappNumber: "966553240111",
  address: {
    ar: "4870 الطريق الدائري الغربي، حي الرحاب، بريدة 52581",
    en: "4870 Western Ring Road, Ar Rihab, Buraidah 52581",
  },
  latitude: "26.4077931",
  longitude: "43.9038318",
} as const;

export function directionsUrl(): string {
  const destination = `${CLUB_CONTACT.latitude},${CLUB_CONTACT.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** رابط محادثة واتساب النادي برسالة جاهزة. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${CLUB_CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * العنوان نفسه مقسومًا إلى حقوله للبيانات المنظَّمة (PostalAddress). لا معلومة جديدة فيه:
 * تفصيل لـ CLUB_CONTACT.address أعلاه. المنطقة الإدارية لا تُذكر لأنها لم ترد في المصدر.
 */
export const CLUB_POSTAL_ADDRESS = {
  street: {
    ar: "4870 الطريق الدائري الغربي، حي الرحاب",
    en: "4870 Western Ring Road, Ar Rihab",
  },
  locality: { ar: "بريدة", en: "Buraidah" },
  postalCode: "52581",
  /** رمز الدولة ISO 3166-1 */
  country: "SA",
} as const;
