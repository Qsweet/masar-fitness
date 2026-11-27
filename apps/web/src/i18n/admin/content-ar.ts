import { contentLockReasonsAr, contentNamespacesAr } from "./content-names-ar";

/** نصوص مجموعة «المحتوى» في اللوحة (ADMIN_A3_CONTENT §9). تُركَّب في `adminAr.content`. */
export const contentAr = {
  nav: { contentTexts: "النصوص", contentPublishing: "النشر والسجل" },
  breadcrumbs: {
    group: "المحتوى",
    namespace: "مساحة نصوص",
    publish: "النشر",
    history: "سجل الإصدارات",
    release: "إصدار",
    rollback: "تأكيد الاسترجاع",
    discard: "تجاهل المسودة",
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
  /** صيغ المعدود بحسب العدد (`countText`): الواحد والاثنان بلا رقم، ثم 3–10، ثم 11 فأكثر. */
  counts: {
    changes: { one: "تغيير واحد", two: "تغييران", few: "تغييرات", many: "تغييرًا" },
    texts: { one: "نص واحد", two: "نصان", few: "نصوص", many: "نصًا" },
  },
  /** فاصل عناصر القائمة في سطر واحد. */
  listSeparator: "، ",
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
  previewBar: {
    label: "معاينة المحتوى",
    draft: "معاينة المسودة — غير منشورة",
    /** {seq}: رقم الإصدار. */
    release: "معاينة الإصدار رقم {seq}",
    note: "لا يراها الزوار.",
    exit: "إنهاء المعاينة",
  },
  preview: {
    draft: "عاين المسودة",
    release: "عاين هذا الإصدار",
  },
  diff: {
    before: "قبل",
    after: "بعد",
    kinds: { added: "تعديل جديد", changed: "تغيّر", removed: "عودة إلى الافتراضي" },
  },
  overview: {
    title: "المحتوى",
    lead: "ما في المسودة مقارنةً بالموقع الآن، وآخر إصدار منشور.",
    draftTitle: "المسودة",
    /** {count}: عدد التغييرات بمعدودها («تغييران»). */
    draftChanges: "لم يُنشر بعد: {count}",
    draftClean: "المسودة تطابق الموقع المنشور. لا شيء ينتظر النشر.",
    baseChanged: "نصوص تغيّر أصلها في الكود بعد تعديلها",
    dropped: "تجاوزات معطّلة لا تُنشر",
    publish: "راجع وانشر",
    discard: "تجاهل المسودة",
    history: "سجل الإصدارات",
    editorNote: "النشر للمالك والمدير. اطلب منهما مراجعة المسودة ونشرها.",
    latestTitle: "آخر إصدار",
    noRelease: "لم يُنشر محتوى بعد: الموقع يعرض النصوص الافتراضية من الكود.",
    seq: "الإصدار",
    publishedBy: "الناشر",
    publishedAt: "الوقت",
    changes: "التغييرات",
    source: "المصدر",
    /** {seq}: رقم الإصدار. */
    seqValue: "رقم {seq}",
    open: "افتح الإصدار",
  },
  publish: {
    title: "مراجعة النشر",
    lead: "هذا ما سيتغير في الموقع لكل الزوار عند النشر. يُنشر كله معًا إصدارًا واحدًا، ويبقى في السجل.",
    /** {count}: عدد التغييرات بمعدودها («3 تغييرات»). */
    count: "ما سيتغير: {count}",
    nothing: "لا شيء للنشر",
    nothingLead: "المسودة تطابق الموقع المنشور.",
    lengthTitle: "عنوان أو وصف خارج ما تعرضه نتائج البحث كاملًا",
    lengthLead: "يُنشر كما هو، لكن محركات البحث قد تقصّه أو تستبدله:",
    droppedNote: "تجاوزات معطّلة في المسودة لا تُنشر (لا تطابق الكود الحالي).",
    confirmTitle: "النشر",
    consequences: [
      "يظهر كل ما سبق للزوار من الطلب التالي، بالعربية والإنجليزية.",
      "يُسجَّل إصدار جديد برقمه واسمك، ويمكن استرجاع أي إصدار سابق لاحقًا.",
      "صلاحية هذه المراجعة عشر دقائق؛ إن تغيّرت المسودة بعدها أُعيدت المراجعة.",
    ],
    submit: "انشر الآن",
  },
  history: {
    title: "سجل الإصدارات",
    lead: "كل نشر واسترجاع إصدار كامل لا يُعدَّل ولا يُحذف. افتح إصدارًا لترى فرقه أو تسترجعه.",
    emptyTitle: "لا إصدارات بعد",
    emptyLead: "يظهر هنا كل إصدار بعد أول نشر.",
    columns: { seq: "الإصدار", source: "المصدر", by: "الناشر", at: "الوقت", changes: "التغييرات" },
    sources: { publish: "نشر", rollback: "استرجاع" },
    /** {seq}: رقم الإصدار المسترجَع منه. */
    rollbackOf: "استرجاع الإصدار {seq}",
    pagination: "صفحات السجل",
    range: "{from} إلى {to} من {total}",
    newer: "الأحدث",
    older: "الأقدم",
    open: "افتح",
    /** {seq}: رقم الإصدار، لقارئ الشاشة. */
    openLabel: "افتح الإصدار {seq}",
  },
  release: {
    /** {seq}: رقم الإصدار. */
    title: "الإصدار {seq}",
    current: "المنشور الآن",
    diffTitle: "ما غيّره هذا الإصدار",
    diffLead: "مقارنةً بالإصدار الذي سبقه (أو بالنصوص الافتراضية للإصدار الأول).",
    noDiff: "لا فرق عن الإصدار السابق.",
    rollback: "استرجع هذا الإصدار",
    rollbackNote: "الاسترجاع للمالك والمدير.",
  },
  rollback: {
    /** {seq}: رقم الإصدار. */
    title: "استرجاع الإصدار {seq}",
    lead: "يعود الموقع إلى نصوص هذا الإصدار بإصدار جديد، والسجل يبقى كما هو.",
    whatTitle: "ما سيعود",
    nothing: "نصوص هذا الإصدار تطابق المنشور الآن.",
    dirtyTitle: "في المسودة تغييرات لم تُنشر",
    dirty:
      "الاسترجاع يستبدل المسودة بنصوص هذا الإصدار، فتضيع تلك التغييرات. انشرها أو تجاهلها أولًا.",
    consequences: [
      "يظهر للزوار من الطلب التالي.",
      "تُستبدل المسودة بنصوص هذا الإصدار، فلا يعيد النشر التالي ما استُرجع منه.",
      "يُسجَّل إصدار جديد مصدره «استرجاع»، ولا يُحذف شيء من السجل.",
    ],
    submit: "استرجع",
    isCurrent: "هذا هو الإصدار المنشور الآن.",
  },
  discard: {
    title: "تجاهل المسودة",
    lead: "تعود المسودة إلى آخر إصدار منشور، فتضيع هذه التغييرات. الموقع لا يتغير.",
    whatTitle: "ما سيُتجاهل",
    nothing: "لا تغييرات في المسودة.",
    consequences: ["تُحذف هذه التغييرات من المسودة ولا تُسترجع.", "الموقع المنشور لا يتغير."],
    submit: "تجاهل التغييرات",
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
    /** {count}: عدد نصوص المساحة بمعدودها («13 نصًا»). */
    lead: "في المساحة {count}. ما في القسم الأول يُعدَّل، وما في الثاني يبقى من الكود بسببه.",
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
  "content.draft_changed":
    "تغيّرت المسودة أو نُشر إصدار بعد مراجعتك. راجع الفرق ثانية ثم أعد المحاولة.",
  "content.nothing_to_publish": "لا شيء للنشر: المسودة تطابق الموقع.",
  "content.draft_invalid":
    "في المسودة نص لا يمر بقواعد التحقق الحالية. افتح المساحات المعدَّلة وصحّحه ثم انشر.",
  "content.publish_token_invalid": "انتهت صلاحية المراجعة (عشر دقائق). افتح صفحة النشر من جديد.",
  "content.release_not_found": "الإصدار غير موجود.",
  "content.rollback_to_current": "هذا هو الإصدار المنشور الآن.",
  "content.rollback_draft_dirty": "في المسودة تغييرات لم تُنشر. انشرها أو تجاهلها قبل الاسترجاع.",
  "content.nothing_to_discard": "لا تغييرات في المسودة.",
  "content.nothing_to_rollback": "نصوص هذا الإصدار تطابق المنشور الآن، فلا شيء يُسترجع.",
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
  content_published: "نُشر المحتوى، وهو في الموقع الآن.",
  content_rolled_back: "استُرجع الإصدار بإصدار جديد، وهو في الموقع الآن.",
  content_draft_discarded: "تُجوهلت المسودة وعادت إلى آخر إصدار.",
} as const;

/** أحداث المحتوى في سجل التدقيق. تُدمج في `audit.salesActions`. */
export const contentAuditActionsAr = {
  content_draft_saved: "حُفظت نصوص في المسودة",
  content_published: "نُشر المحتوى",
  content_rolled_back: "استُرجع إصدار محتوى",
  content_draft_discarded: "تُجوهلت مسودة المحتوى",
} as const;

/** تسميات مفاتيح `data` في أسطر تدقيق المحتوى. */
export const contentAuditDetailsAr = {
  target: "المساحة",
  changedCount: "التغييرات",
  seq: "الإصدار",
  fromSeq: "من الإصدار",
  digest: "البصمة",
} as const;
