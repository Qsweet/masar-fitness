/**
 * نصوص هيكل اللوحة v2 (ADMIN_REDESIGN §4): الشريط الجانبي والعلوي، ولوحة الأوامر، والاختصارات، وصفحة
 * البحث. جزء من قاموس اللوحة العربي (ar.ts)، مفصول لحجمه.
 */
export const shellAr = {
  collapse: "اطوِ الشريط الجانبي",
  expand: "ابسط الشريط الجانبي",
  openMenu: "افتح قائمة الأقسام",
  closeMenu: "أغلق القائمة",
  drawerNav: "أقسام اللوحة (القائمة)",
  newTab: "(يفتح في تبويب جديد)",
  /** سطر تحت الشعار: النادي الذي تعمل عليه اللوحة. بنادٍ واحد اسم لا قائمة. */
  clubLabel: "النادي",
  search: "ابحث عن صفحة أو إجراء…",
  searchShort: "ابحث",
  /** شارة البيئة في الشريط العلوي، ولا شارة حين يكون الدفع حيًّا. */
  environment: {
    preview: "معاينة بلا دفع",
    test: "دفع تجريبي",
  },
  theme: { toLight: "بدّل المظهر إلى الفاتح", toDark: "بدّل المظهر إلى الداكن" },
  help: "المساعدة والاختصارات",
  /** عدّادات الشريط الجانبي لقارئ الشاشة. {count}: العدد. */
  counts: {
    awaiting: "{count} بانتظار الدفع",
    drafts: "{count} تعديلًا في المسودة",
  },
  density: {
    label: "الكثافة",
    comfortable: "كثافة مريحة",
    compact: "كثافة مضغوطة",
  },
  shortcutsToggle: { on: "شغّل اختصارات لوحة المفاتيح", off: "أطفئ اختصارات لوحة المفاتيح" },
  /** إجراءات لوحة الأوامر والإجراءات السريعة: كلٌّ رابط إلى الصفحة التي تنفّذه بحارسها. */
  actions: {
    newSlide: { label: "شريحة جديدة", hint: "للشريط تحت الواجهة" },
    newPlan: { label: "أضف اشتراكًا", hint: "يُنشأ مسودة حتى تنشره" },
    newPromotion: { label: "أنشئ عرضًا", hint: "كوبون أو خصم تلقائي" },
    findOrder: { label: "ابحث عن طلب", hint: "بالمرجع أو أرقامه" },
    awaitingOrders: { label: "الطلبات بانتظار الدفع", hint: "المفتوحة التي لم تبلغ مهلتها" },
    newStaff: { label: "أضف موظفًا", hint: "بكلمة مؤقتة وتحقق بخطوتين" },
    previewDraft: { label: "عاين المسودة", hint: "الموقع كما سيظهر بعد النشر" },
    reviewPublish: { label: "راجع وانشر", hint: "تغييرات المسودة قبل نشرها" },
  },
  /**
   * كلمات بحث إضافية لكل صفحة وإجراء (الإنجليزية وما يكتبه الموظف بغير اسم القسم). لا تُعرض.
   */
  keywords: {
    overview: "overview dashboard home الرئيسية لوحة",
    orders: "orders sales طلب مبيعات",
    customers: "customers clients عميل جوال",
    plans: "plans memberships catalog باقة باقات كتالوج",
    promotions: "promotions coupons discounts كوبون خصم",
    salesSettings: "sales settings payment window مهلة",
    contentTexts: "content texts copy نص محتوى",
    contentSlider: "slider slides hero شريحة",
    contentMedia: "media images photos صورة",
    contentPublishing: "publish history releases نشر إصدار",
    staff: "staff team users موظف فريق",
    audit: "audit log سجل تدقيق",
    integrations:
      "integrations tracking pixel gtm ga4 google ads meta snap tiktok x twitter إكس تويتر ربط بكسل قياس إعلانات",
    account: "account password sessions حساب كلمة المرور",
    newSlide: "new slide شريحة",
    newPlan: "new plan membership باقة",
    newPromotion: "new promotion coupon كوبون",
    findOrder: "find order reference MSR مرجع",
    awaitingOrders: "pending awaiting orders معلق",
    newStaff: "new staff user موظف",
    previewDraft: "preview draft معاينة",
    reviewPublish: "review publish نشر",
  },
  palette: {
    title: "لوحة الأوامر",
    input: "ابحث عن صفحة أو إجراء",
    scopesLabel: "نطاق البحث",
    scopes: { all: "الكل", page: "الصفحات", action: "الإجراءات" },
    groups: { recent: "الأخيرة", page: "انتقل إلى", action: "إجراءات" },
    empty: "لا نتيجة. جرّب كلمة أخرى أو نطاقًا آخر.",
    /** عدد النتائج بصيغته، تعلنه منطقة حية («3 نتائج»، «نتيجتان»). */
    results: { one: "نتيجة واحدة", two: "نتيجتان", few: "نتائج", many: "نتيجة" },
    noResults: "لا نتائج",
    close: "أغلق لوحة الأوامر",
    hints: { move: "تنقّل", open: "افتح", scope: "بدّل النطاق", close: "أغلق" },
    scopeNote: "النتائج بصلاحياتك فقط",
  },
  shortcuts: {
    title: "اختصارات لوحة المفاتيح",
    lead: "تعمل خارج الحقول. ⌘K وEsc تعمل في كل مكان.",
    then: "ثم",
    off: "الاختصارات مطفأة. ⌘K يبقى يعمل.",
    close: "أغلق",
    items: {
      palette: "افتح لوحة الأوامر",
      search: "حقل البحث في الصفحة",
      help: "اعرض هذه القائمة",
      sidebar: "اطوِ الشريط الجانبي أو ابسطه",
      escape: "أغلق القائمة أو الحوار",
      overview: "انتقل إلى نظرة عامة",
      orders: "انتقل إلى الطلبات",
      customers: "انتقل إلى العملاء",
      contentTexts: "انتقل إلى النصوص",
      contentSlider: "انتقل إلى شريط الشرائح",
    },
  },
  searchPage: {
    title: "البحث في اللوحة",
    lead: "الصفحات والإجراءات المتاحة لك. البحث عن الطلبات بالمرجع في صفحة الطلبات، وعن العملاء بالجوال في صفحة العملاء.",
    query: "ابحث",
    submit: "ابحث",
    shortcutsTitle: "اختصارات لوحة المفاتيح",
  },
} as const;
