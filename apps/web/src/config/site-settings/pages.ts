import type { SettingValues } from "@masar/domain";

/**
 * افتراضيات صفحة الموقع وصفحات البرامج. المواقف وملاحظة الوصول فارغتان: لا مصدر مؤكد لهما. نقاط «ماذا
 * يشمل» من صفحات المنتجات القديمة بلا أعداد حصص ولا أسعار، مسودةً بانتظار تأكيد المالك.
 */
export const LOCATION_DEFAULT: SettingValues["page.location"] = {
  parking: { ar: "", en: "" },
  arrival: { ar: "", en: "" },
};

const draft = { visible: false, pending: true } as const;
const NO_NOTE = { ar: "", en: "" } as const;

export const PERSONAL_TRAINING_DEFAULT: SettingValues["program.personalTraining"] = {
  summary: {
    ar: "حصص فردية مع مدرب داخل النادي، تبدأ بتقييم مستواك وبرنامج مخصص لهدفك.",
    en: "One-to-one sessions with a coach in the club, starting with an assessment and a programme built for your goal.",
  },
  note: NO_NOTE,
  points: [
    {
      text: {
        ar: "تقييم مستوى اللياقة ومناقشة هدفك عند البداية.",
        en: "A fitness assessment and a talk about your goal at the start.",
      },
      ...draft,
    },
    {
      text: {
        ar: "برنامج تمارين مخصص يتناسب مع احتياجك ومستواك.",
        en: "A training programme tailored to your needs and level.",
      },
      ...draft,
    },
    {
      text: {
        ar: "تصحيح وضعية الجسم وطريقة أداء التمارين خلال الحصص.",
        en: "Posture and technique correction during the sessions.",
      },
      ...draft,
    },
    {
      text: {
        ar: "تُنسَّق المواعيد مع المدرب وفق المتاح.",
        en: "Session times are arranged with the coach, subject to availability.",
      },
      ...draft,
    },
  ],
};

export const REHAB_DEFAULT: SettingValues["program.rehab"] = {
  summary: {
    ar: "جلسات للعودة التدريجية إلى التمرين بعد الإصابة، تبدأ بتقييم أولي للحالة.",
    en: "Sessions for a gradual return to training after an injury, starting with an initial assessment.",
  },
  note: {
    ar: "ليس علاجًا طبيعيًا ولا تشخيصًا طبيًا، ويتطلب موافقة طبية للعودة إلى النشاط.",
    en: "Not physiotherapy or a medical diagnosis. Medical clearance to return to activity is required.",
  },
  points: [
    {
      text: {
        ar: "تقييم أولي للحالة والقدرة الحركية ضمن نطاق البرنامج الرياضي.",
        en: "An initial assessment of your condition and mobility, within the scope of a training programme.",
      },
      ...draft,
    },
    {
      text: {
        ar: "تمارين تُختار بحسب مستوى الاستعداد والقيود الحركية.",
        en: "Exercises chosen for your readiness and movement restrictions.",
      },
      ...draft,
    },
    {
      text: {
        ar: "متابعة وتوجيه أثناء أداء التمارين خلال الجلسات.",
        en: "Supervision and guidance while you train in each session.",
      },
      ...draft,
    },
    {
      text: {
        ar: "أخبر الفريق بتوجيهات طبيبك وأي قيود على النشاط قبل أول جلسة.",
        en: "Tell the team about your doctor's guidance and any activity restrictions before the first session.",
      },
      ...draft,
    },
  ],
};

export const SWIMMING_DEFAULT: SettingValues["program.swimming"] = {
  summary: {
    ar: "من الصفر في المسبح الداخلي، بإشراف مدرب متخصص في تعليم السباحة.",
    en: "From scratch in the indoor pool, with a coach who specialises in teaching swimming.",
  },
  note: NO_NOTE,
  points: [
    {
      text: {
        ar: "التأقلم مع الماء وبناء الثقة تدريجيًا.",
        en: "Getting used to the water and building confidence step by step.",
      },
      ...draft,
    },
    {
      text: {
        ar: "أساسيات التنفس والحركة داخل الماء.",
        en: "The basics of breathing and moving in the water.",
      },
      ...draft,
    },
    {
      text: { ar: "وضعية الجسم والتوازن.", en: "Body position and balance." },
      ...draft,
    },
    {
      text: {
        ar: "متابعة مباشرة وتصحيح الأداء.",
        en: "Direct supervision and technique correction.",
      },
      ...draft,
    },
  ],
};
