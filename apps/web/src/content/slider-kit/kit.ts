/**
 * عدّة إطلاق الشريط (docs/SLIDER_KIT.md): خمس شرائح جاهزة بصور النادي الحقيقية المعالجة فنيًا ونصوص
 * من حقائق الموقع نفسها (القاموس، docs/CLUB_FACTS.md). هذه **بيانات محتوى** لا نصوص واجهة: الأمر
 * `pnpm slider:launch-kit` ينسخها إلى مسودة الشريط مرة واحدة، وبعدها تُحرَّر من اللوحة وحدها. لا سعر ولا
 * رقم ولا وعد غير موجود في الموقع. الروابط من قائمة الروابط الداخلية المعروفة (ADMIN_A3_SLIDER §3).
 */
export const SLIDE_KIT_IDS = [
  "coaches",
  "classes",
  "equipment",
  "recovery",
  "memberships",
] as const;
export type SlideKitId = (typeof SLIDE_KIT_IDS)[number];

export interface KitTexts {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly cta: string;
}

export interface KitSlide {
  readonly id: SlideKitId;
  /** المسار الداخلي بلا لغة (يُرسم بلغة الزائر). */
  readonly link: string;
  readonly alt: { readonly ar: string; readonly en: string };
  readonly texts: { readonly ar: KitTexts; readonly en: KitTexts };
}

/** مجلد الصور المصممة من مجلد الويب، واسما ملفي كل شريحة (يكتبهما `pnpm slider:design`). */
export const SLIDE_KIT_DIR = "src/assets/slider-kit";

export function kitImageFile(id: SlideKitId, kind: "desktop" | "mobile"): string {
  return `${id}-${kind}.jpg`;
}

/** التشغيل التلقائي مفعّل بفاصل 7 ثوانٍ (الافتراضي الموثق في ADMIN_A3_SLIDER §5). */
export const SLIDE_KIT_SETTINGS = { autoplay: true, intervalMs: 7_000 } as const;

export const SLIDE_KIT: readonly KitSlide[] = [
  {
    id: "coaches",
    link: "/#services",
    alt: {
      ar: "مدرب بقميص النادي يقف عاقدًا ذراعيه في صالة الحديد",
      en: "A trainer in a club shirt, arms crossed, on the strength floor",
    },
    texts: {
      ar: {
        eyebrow: "فريق التدريب",
        title: "مدربون معتمدون معك من أول يوم",
        subtitle: "في الصالة دائمًا لمساعدتك.",
        cta: "تعرّف على التدريب الشخصي",
      },
      en: {
        eyebrow: "Coaching team",
        title: "Certified coaches with you from day one",
        subtitle: "Always on the floor to help.",
        cta: "About personal training",
      },
    },
  },
  {
    id: "classes",
    link: "/#facilities",
    alt: {
      ar: "مجموعة تتمرن بالبارات على الأرضية الخضراء في منطقة التمارين الوظيفية",
      en: "A group training with barbells on the green floor of the functional area",
    },
    texts: {
      ar: {
        eyebrow: "الحصص الجماعية",
        title: "حصص تجمع المتعة والتحدي",
        subtitle: "حصص HIIT و HYROX و Boot Camp ضمن الاشتراك.",
        cta: "تصفّح المرافق",
      },
      en: {
        eyebrow: "Group classes",
        title: "Classes that mix fun and challenge",
        subtitle: "HIIT, HYROX and Boot Camp, in your membership.",
        cta: "Explore the facilities",
      },
    },
  },
  {
    id: "equipment",
    link: "/#about",
    alt: {
      ar: "أجهزة أثقال صفراء على عشب أخضر وجدارية العدّاء على الجدار",
      en: "Yellow weight machines on green turf beneath the runner mural",
    },
    texts: {
      ar: {
        eyebrow: "صالة الحديد",
        title: "أجهزة عالمية وأوزان حرة",
        subtitle: "أجهزة Life Fitness و Hammer Strength للصدر والظهر والأكتاف والذراعين والأرجل.",
        cta: "تعرّف على النادي",
      },
      en: {
        eyebrow: "Strength floor",
        title: "World-class machines and free weights",
        subtitle: "Life Fitness and Hammer Strength for chest, back, shoulders, arms and legs.",
        cta: "About the club",
      },
    },
  },
  {
    id: "recovery",
    link: "/#water",
    alt: {
      ar: "المسبح الداخلي وشعار النادي على جداره، وبجانبه حجارة الساونا الساخنة داخل غرفة خشبية",
      en: "The indoor pool with the club logo on its wall, beside hot sauna stones inside a wooden room",
    },
    texts: {
      ar: {
        eyebrow: "الاستشفاء",
        title: "مسبح داخلي وجاكوزي وساونا وبخار",
        subtitle: "كلها ضمن اشتراكك، للاسترخاء واستشفاء العضلات بعد التمرين.",
        cta: "تعرّف على المسبح",
      },
      en: {
        eyebrow: "Recovery",
        title: "Indoor pool, jacuzzi, sauna and steam room",
        subtitle: "All in your membership, to relax and recover after training.",
        cta: "About the pool",
      },
    },
  },
  {
    id: "memberships",
    link: "/memberships",
    alt: {
      ar: "صف مقاعد البنش بأقراص 20 كيلوغرامًا أمام جدار مخطط بالأصفر والأسود تحت إضاءة خافتة",
      en: "A row of bench-press stations loaded with 20 kg plates before a yellow-and-black striped wall",
    },
    texts: {
      ar: {
        eyebrow: "الاشتراكات",
        title: "كل اشتراك يشمل مرافق النادي كاملة",
        subtitle: "الفرق في المدة والسعر. سعر إجمالي يُدفع مرة واحدة.",
        cta: "اختر مدة اشتراكك",
      },
      en: {
        eyebrow: "Memberships",
        title: "Every membership includes all the club's facilities",
        subtitle: "The difference is the duration and the price. One total payment.",
        cta: "Choose your duration",
      },
    },
  },
];
