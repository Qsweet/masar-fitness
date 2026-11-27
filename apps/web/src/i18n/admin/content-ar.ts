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
      status: "الحالة",
    },
    open: "افتح",
    /** {path}: مسار النص، لقارئ الشاشة. */
    openLabel: "افتح {path}",
  },
  statuses: {
    default: "الافتراضي",
    locked: "للقراءة فقط",
  },
  namespace: {
    /** {count}: عدد نصوص المساحة. */
    lead: "{count} نصًا. ما في القسم الأول يُعدَّل، وما في الثاني يبقى من الكود بسببه.",
    editableTitle: "النصوص",
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
