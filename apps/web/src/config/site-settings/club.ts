import type { SettingValues } from "@masar/domain";

/**
 * افتراضيات بيانات النادي (ADMIN_A3_CONTENT §5): المصدر الواحد للتواصل والعنوان والأوقات، وتُعدَّل من
 * اللوحة بإصدار محتوى. المنشور هنا ما أكده المالك وحده (docs/research/OLD_SITE_GAP.md «أجوبة المالك»
 * 2026-11-28): العنوان والإحداثيات والرمز من ملف Google الرسمي. ما لم يُؤكَّد (البريد، السجل التجاري،
 * الرقم الضريبي، تقييم Google، التقسيط وSTC Pay، عدد الأجهزة) فارغ أو مطفأ حتى يدخله المالك.
 */
export const CONTACT_DEFAULT: SettingValues["club.contact"] = {
  phone: "+966163240111",
  whatsapp: "+966553240111",
  email: "",
  street: {
    ar: "4870 الطريق الدائري الغربي، 8177، حي الرحاب",
    en: "4870 Western Ring Road, 8177, Ar Rihab",
  },
  locality: { ar: "بريدة", en: "Buraidah" },
  postalCode: "52581",
  latitude: "26.4077931",
  longitude: "43.9038318",
  mapUrl: "https://maps.app.goo.gl/YBbFEXF2StKmbn137",
  directionsUrl: "",
  plusCode: "CW53+4G",
};

export const SOCIAL_DEFAULT: SettingValues["club.social"] = {
  instagram: "https://www.instagram.com/Mmastersway",
  x: "https://x.com/mmastersway",
  snapchat: "https://www.snapchat.com/add/Mmastersway",
  tiktok: "https://www.tiktok.com/@Mmastersway",
};

export const FACTS_DEFAULT: SettingValues["club.facts"] = {
  foundedYear: "2018",
  machinesOver: "",
  commercialRegistration: "",
  showCommercialRegistration: false,
  vatNumber: "",
  showVatNumber: false,
};

export const RATING_DEFAULT: SettingValues["club.rating"] = {
  show: false,
  value: "",
  count: "",
  asOf: "",
};

export const PAYMENT_MARKS_DEFAULT: SettingValues["club.paymentMarks"] = {
  mada: true,
  applePay: true,
  stcPay: false,
  tabby: false,
  tamara: false,
  bank: true,
};

const GYM = {
  satThu: { opens: "06:00", closes: "02:00" },
  fri: { opens: "13:00", closes: "00:00" },
};
const POOL = {
  satThu: { opens: "08:00", closes: "23:30" },
  fri: { opens: "15:00", closes: "21:00" },
};

/** أوقات رمضان والأعياد يدخلها المالك من اللوحة: القائمة فارغة ولا وقت يُخترع. */
export const HOURS_DEFAULT: SettingValues["club.hours"] = { gym: GYM, pool: POOL, specials: [] };
