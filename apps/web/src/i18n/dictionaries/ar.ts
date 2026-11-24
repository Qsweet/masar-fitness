/** القاموس العربي هو المرجع: شكله يحدد المفاتيح المطلوبة من كل لغة أخرى. */
export const ar = {
  club: { name: "مسار الأبطال الرياضي", city: "بريدة" },
  foundation: {
    title: "مسار الأبطال الرياضي",
    lead: "موقعنا الجديد قيد التجهيز.",
    switchLanguage: "English",
  },
  notFound: {
    title: "الصفحة غير موجودة",
    lead: "الرابط الذي فتحته غير صحيح أو أن الصفحة نُقلت.",
    home: "العودة للرئيسية",
  },
} as const;

type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Dictionary = Widen<typeof ar>;
