import { contentLockReasonsAr, contentNamespacesAr } from "./content-names-ar";

/** نصوص مجموعة «المحتوى» في اللوحة (ADMIN_A3_CONTENT §9). تُركَّب في `adminAr.content`. */
export const contentAr = {
  nav: { contentTexts: "النصوص" },
  breadcrumbs: {
    group: "المحتوى",
    namespace: "مساحة نصوص",
  },
  errorPage: {
    title: "تعذّر عرض هذه الصفحة",
    lead: "حدث عطل غير متوقع وسُجّل. حاول من جديد، وإن تكرر أبلغ مدير النظام.",
    retry: "حاول من جديد",
  },
  namespaces: contentNamespacesAr,
  lockReasons: contentLockReasonsAr,
  kinds: {
    label: "تسمية",
    short: "سطر قصير",
    line: "سطر",
    paragraph: "فقرة",
    metaTitle: "عنوان لمحركات البحث",
    metaDescription: "وصف لمحركات البحث",
  },
  locales: { ar: "العربية", en: "الإنجليزية" },
  texts: {
    title: "نصوص الموقع",
    lead: "نصوص الصفحات العامة باللغتين. القيمة الافتراضية من الكود، وما يُعدَّل يُحفظ فوقها.",
    searchLegend: "ابحث في النصوص",
    search: "ابحث في المسار أو النص",
    searchHint: "بالعربية أو الإنجليزية، مثل «المسبح» أو hero.title.",
    submit: "ابحث",
    clear: "امسح البحث",
    treeTitle: "المساحات",
    treeLead: "كل مساحة جزء من الموقع. افتح مساحة لترى نصوصها.",
    editableGroup: "قابلة للتعديل",
    lockedGroup: "للقراءة فقط",
    /** {editable}: القابل للتعديل، {total}: كل نصوص المساحة. */
    namespaceCount: "{editable} من {total}",
    resultsTitle: "نتائج البحث",
    /** {count}: عدد النتائج. */
    resultsCount: "النتائج: {count}",
    /** {shown}: المعروض. */
    resultsTruncated: "تُعرض أول {shown} نتيجة. ضيّق البحث لترى غيرها.",
    noResults: "لا نص يطابق البحث",
    noResultsLead: "جرّب كلمة أخرى أو جزءًا من المسار.",
    columns: {
      path: "المسار",
      default: "الافتراضي",
      published: "المنشور",
      draft: "المسودة",
      status: "الحالة",
    },
    open: "افتح",
    /** {path}: مسار النص، لقارئ الشاشة. */
    openLabel: "افتح {path}",
  },
  statuses: {
    default: "الافتراضي",
    published: "منشور",
    draft: "معدَّل في المسودة",
    baseChanged: "تغيّر الأصل",
    locked: "للقراءة فقط",
  },
  form: {
    /** {locale}: اسم اللغة. */
    fieldLabel: "النص المعروض · {locale}",
    /** {count}: المكتوب، {limit}: الحد. */
    counter: "{count} من {limit}",
    revert: "عودة إلى الافتراضي",
    publishedNow: "المنشور الآن:",
    baseChanged:
      "تغيّر النص الأصلي في الكود بعد تعديلك. قارن تعديلك بالأصل الجديد أعلاه، ثم احفظه أو أعده إلى الافتراضي.",
    save: "احفظ في المسودة",
    saveNote: "الحفظ لا يغيّر الموقع. يظهر التعديل للزوار بعد النشر.",
  },
  dropped: {
    /** {count}: عددها. */
    title: "تجاوزات معطّلة: {count}",
    lead: "تعديلات في المسودة لم تعد تطابق نص الموقع بعد تحديث الكود (حُذف النص أو تغيّرت عناصره). لا تُنشر ولا تظهر في المعاينة: افتح المساحة وأعد كتابتها إن لزم.",
  },
  lintRules: {
    "double-space": "مسافتان متتاليتان",
    "edge-space": "مسافة في أول النص أو آخره",
    "latin-punctuation": "فاصلة أو علامة استفهام لاتينية بين كلمات عربية",
    "space-before-punctuation": "مسافة قبل علامة الترقيم",
    "missing-space-after": "لا مسافة بعد علامة الترقيم",
    tatweel: "تطويل (ـ) للزخرفة",
    "arabic-indic-digits": "أرقام هندية (٣) بدل الأرقام (3)",
    "latin-touching-arabic": "حرف لاتيني ملاصق لحرف عربي",
    "ascii-ellipsis": "ثلاث نقاط بدل علامة الحذف (…)",
    "unbalanced-pair": "قوس أو علامة اقتباس بلا نظير",
    "inconsistent-quotes": "علامات اقتباس من نوعين",
  },
  namespace: {
    /** {count}: عدد نصوص المساحة. */
    lead: "{count} نصًا. ما في القسم الأول يُعدَّل، وما في الثاني يبقى من الكود بسببه.",
    editableTitle: "النصوص",
    editableLead: "عدّل النص بلغته في حقله. ما تحفظه يدخل المسودة، ولا يراه الزوار قبل النشر.",
    lockedTitle: "للقراءة فقط",
    lockedLead: "تبقى كما في الكود، ولكلٍّ سببه.",
    reason: "لماذا للقراءة",
    defaultLabel: "الافتراضي",
    placeholders: "عناصر يملؤها الكود",
    placeholdersHint: "تبقى في النص كما هي، بالأقواس.",
    /** {limit}: أقصى عدد للمحارف. */
    limit: "حتى {limit} محرف",
    factsOnly: "يعدّله المالك والمدير وحدهما.",
    noEditable: "لا نص قابلًا للتعديل في هذه المساحة.",
  },
} as const;

/** أسباب رفض حفظ النصوص (`content.*`) بنصوصها. تُدمج في `adminAr.errors`. */
export const contentErrorsAr = {
  "content.empty": "النص فارغ. لإعادة النص الأصلي استعمل «عودة إلى الافتراضي».",
  "content.placeholder_missing": "ينقص العنصر {name}. يبقى في النص كما هو بأقواسه.",
  "content.placeholder_unknown": "العنصر {name} ليس في النص الأصلي. احذفه أو اكتبه بلا أقواس.",
  "content.brace_stray": "قوس معقوف { أو } خارج عنصر صحيح. احذفه.",
  "content.multiline": "النص سطر واحد: احذف السطر الجديد.",
  "content.too_long": "النص أطول من {name} محرف.",
  "content.copy_lint": "خطأ كتابة: {name}.",
  "content.stale_edit":
    "عدّل غيرك هذا النص بعد فتحك الصفحة. حدّث الصفحة لترى نسخته، ثم أعد تعديلك.",
  "content.no_changes": "لا تغيير لحفظه.",
} as const;

/** تنبيهات النجاح بعد إجراءات المحتوى (`?done=`). تُدمج في `adminAr.notices`. */
export const contentNoticesAr = {
  content_draft_saved: "حُفظ في المسودة. لا يتغير الموقع حتى النشر.",
  content_text_reverted: "أُعيد النص إلى الافتراضي في المسودة.",
} as const;
