import { HOME_SECTION_IDS, type SettingValues } from "@masar/domain";

/**
 * افتراضيات الرئيسية. ما استُورد من الموقع القديم ولم يؤكده المالك مخفي ومعلَّم «بانتظار تأكيد المالك»
 * (`pending`): يراه في اللوحة، ولا يظهر في الموقع حتى يرفع التعليق وينشر.
 */
export const SECTIONS_DEFAULT: SettingValues["home.sections"] = {
  friendsOffer: false,
  items: HOME_SECTION_IDS.map((id) => ({ id, visible: true })),
};

const draft = { visible: false, pending: true } as const;

/**
 * أسئلة الرئيسية القديمة (docs/research/OLD_SITE_GAP.md §1.2): خمسة من ثمانية، مسودةً. أُسقطت ثلاثة تعتمد
 * على ما لم يُؤكَّد: سؤال السعر (الأسعار من الكتالوج)، وسؤال التقسيط (تابي وتمارا وSTC Pay)، وسؤال الأجهزة
 * (عددها وعلاماتها). وسؤال الموقع صُحِّح عنوانه إلى «الغربي» المؤكد، وسؤال البرامج بلا أعداد الحصص.
 */
export const FAQ_DEFAULT: SettingValues["home.faq"] = {
  items: [
    {
      question: {
        ar: "هل في النادي مسبح وساونا وجاكوزي؟",
        en: "Does the club have a pool, sauna and jacuzzi?",
      },
      answer: {
        ar: "نعم، في النادي مسبح داخلي متدرج العمق من 1.5 إلى 3.5 متر، وجاكوزي حار وبارد، وساونا وغرفة بخار.",
        en: "Yes. The club has an indoor pool that deepens from 1.5 to 3.5 metres, a hot and a cold jacuzzi, a sauna and a steam room.",
      },
      ...draft,
    },
    {
      question: { ar: "ما أوقات عمل النادي؟", en: "What are the opening hours?" },
      answer: {
        ar: "يفتح النادي من السبت إلى الخميس من 6:00 صباحًا حتى 2:00 فجرًا، والجمعة من 1:00 ظهرًا حتى 12:00 منتصف الليل. المسبح يعمل من 8:00 صباحًا حتى 11:30 مساءً، والجمعة من 3:00 حتى 9:00 مساءً.",
        en: "The club opens Saturday to Thursday from 6:00 AM to 2:00 AM, and on Friday from 1:00 PM to midnight. The pool opens from 8:00 AM to 11:30 PM, and on Friday from 3:00 PM to 9:00 PM.",
      },
      ...draft,
    },
    {
      question: { ar: "هل النادي رجالي فقط؟", en: "Is the club for men only?" },
      answer: {
        ar: "نعم، نادي مسار الأبطال الرياضي نادٍ رجالي في بريدة.",
        en: "Yes. Masar Al-Abtal is a men's fitness club in Buraidah.",
      },
      ...draft,
    },
    {
      question: {
        ar: "هل يوجد مدرب شخصي وتأهيل للإصابات؟",
        en: "Do you offer personal training and injury rehabilitation?",
      },
      answer: {
        ar: "نعم، تتوفر باقات تدريب شخصي بحصص فردية، وبرامج تأهيل الإصابات الرياضية مع تقييم أولي للحالة، وتعليم السباحة للكبار.",
        en: "Yes. We offer one-to-one personal training packages, sports injury rehabilitation programmes with an initial assessment, and adult swimming lessons.",
      },
      ...draft,
    },
    {
      question: { ar: "أين يقع النادي؟", en: "Where is the club?" },
      answer: {
        ar: "يقع نادي مسار الأبطال الرياضي على الطريق الدائري الغربي في حي الرحاب ببريدة. اضغط «الاتجاهات» للوصول عبر خرائط Google.",
        en: "Masar Al-Abtal is on the Western Ring Road in Ar Rihab, Buraidah. Tap “Directions” to navigate with Google Maps.",
      },
      ...draft,
    },
  ],
};

const live = { visible: true, pending: false } as const;
const NO_DETAIL = { ar: "", en: "" } as const;

/** مرافق مؤكدة فقط: الساونا وغرفة البخار كلاهما موجود (جواب المالك 2026-11-28). */
export const FACILITIES_DEFAULT: SettingValues["home.facilities"] = {
  items: [
    {
      icon: "dumbbell",
      name: { ar: "صالة الحديد", en: "Weights hall" },
      detail: NO_DETAIL,
      ...live,
    },
    {
      icon: "users",
      name: { ar: "منطقة التمارين الوظيفية", en: "Functional training area" },
      detail: NO_DETAIL,
      ...live,
    },
    {
      icon: "waves",
      name: { ar: "مسبح داخلي", en: "Indoor pool" },
      detail: { ar: "متدرج العمق من 1.5 إلى 3.5 متر.", en: "Deepens from 1.5 to 3.5 metres." },
      ...live,
    },
    {
      icon: "waves",
      name: { ar: "جاكوزي حار وبارد", en: "Hot and cold jacuzzi" },
      detail: NO_DETAIL,
      ...live,
    },
    { icon: "flame", name: { ar: "ساونا", en: "Sauna" }, detail: NO_DETAIL, ...live },
    { icon: "flame", name: { ar: "غرفة بخار", en: "Steam room" }, detail: NO_DETAIL, ...live },
  ],
};

const unconsented = { author: "", source: "google", consent: false, visible: false } as const;

/**
 * ثلاثة آراء من رئيسية الموقع القديم بنصها، بلا اسم صاحبها ولا اسم مدرب: مخفية حتى يسجّل المالك موافقة
 * صاحب كل رأي. ما يذكر مدربًا باسمه لم يُستورد.
 */
export const TESTIMONIALS_DEFAULT: SettingValues["home.testimonials"] = {
  items: [
    {
      quote: {
        ar: "نادي المسار ممتاز وحاليًا لي 4 سنوات فيه ولا فكرت أغيره؛ المدربين ما يقصرون ويمشون معنا خطوة خطوة ويرفعون معنوياتنا.",
        en: "",
      },
      ...unconsented,
    },
    {
      quote: {
        ar: "نادي رياضي رجالي ممتاز في بريدة. أعجبني تنوع الأجهزة والنظافة ووجود مسبح وساونا بعد التمرين، والبيئة هادئة ومريحة.",
        en: "",
      },
      ...unconsented,
    },
    {
      quote: {
        ar: "نادي مميز جدًا: نظافة وآلات كاملة والمدربين مميزين. نادي مكتمل الجودة.",
        en: "",
      },
      ...unconsented,
    },
  ],
};

export const ANNOUNCEMENT_DEFAULT: SettingValues["site.announcement"] = {
  enabled: false,
  text: { ar: "", en: "" },
  linkKind: "none",
  linkPath: "",
  linkLabel: { ar: "", en: "" },
  from: "",
  to: "",
  dismissible: true,
};
