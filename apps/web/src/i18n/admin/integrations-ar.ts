/**
 * نصوص «الربط والقياس» (ADMIN_A5_TRACKING §8). العربي هو المرجع. أسماء المنصات علامات تجارية
 * تُكتب كما هي. أماكن القيم في لوحات المنصات من §8.1.
 */
export const integrationsAr = {
  nav: "الربط والقياس",
  title: "الربط والقياس",
  lead: "وسوم المتصفح تُحمَّل بعد موافقة الزائر وحدها، والشراء يصل المنصة من الخادم بعد تحقق الدفع. لا يعمل شيء قبل أن تفعّله هنا.",
  providerTitle: "{provider}",
  backToHub: "كل المنصات",
  statuses: {
    enabled: "مفعَّل",
    disabled: "متوقف",
    notConfigured: "لم يُضبط",
    missingSecret: "ينقصه المفتاح الخادمي",
  },
  providers: {
    gtm: {
      name: "Google Tag Manager",
      lead: "حاوية وسومك. تُحمَّل بموافقة الزائر على التحليلات والإعلانات معًا، ومعها حالة Consent Mode لكل فئة.",
    },
    ga4: {
      name: "Google Analytics 4",
      lead: "قياس الزيارات والتجارة في المتصفح، والشراء من الخادم عبر Measurement Protocol.",
    },
    google_ads: {
      name: "Google Ads",
      lead: "تحويل الشراء في صفحة الطلب المدفوع مع التحويلات المحسّنة (جوال مجزّأ). لا إرسال خادمي بعد.",
    },
    meta: {
      name: "Meta",
      lead: "في المتصفح: Meta Pixel. وللشراء من الخادم: Conversions API.",
    },
    snap: {
      name: "Snapchat",
      lead: "في المتصفح: Snap Pixel. وللشراء من الخادم: Conversions API.",
    },
    tiktok: {
      name: "TikTok",
      lead: "في المتصفح: TikTok Pixel. وللشراء من الخادم: Events API.",
    },
    x: {
      name: "X",
      lead: "في المتصفح: X Pixel، والشراء وإضافة السلة والاستفسار بمعرّفات أحداثك. لا إرسال خادمي بعد.",
    },
  },
  form: {
    title: "الإعداد",
    enabled: "مفعَّل",
    enabledHint: "التفعيل يحمّل الوسم لمن يوافق من الزوار، ويرسل الشراء من الخادم إن ضُبط المفتاح.",
    fields: {
      containerId: {
        label: "معرّف الحاوية",
        hint: "GTM-XXXXXXX: في Tag Manager أعلى صفحة الحاوية.",
      },
      measurementId: {
        label: "معرّف القياس",
        hint: "G-XXXXXXXXXX: في Analytics ← المشرف ← مصادر البيانات ← تدفق الويب.",
      },
      conversionId: {
        label: "معرّف التحويل",
        hint: "AW-XXXXXXXXX: Google Ads ← الأهداف ← التحويلات ← إجراء الشراء ← إعداد الوسم.",
      },
      conversionLabel: {
        label: "تسمية التحويل",
        hint: "ما بعد الشرطة المائلة في send_to من إعداد الوسم نفسه.",
      },
      pixelId: { label: "معرّف البكسل", hint: "من Events Manager في لوحة المنصة." },
      purchaseEventId: {
        label: "معرّف حدث الشراء",
        hint: "tw-XXXXX-XXXXX: Events Manager ← البكسل ← إضافة حدث «Purchase» ← معرّف الحدث في شيفرته. مطلوب.",
      },
      addToCartEventId: {
        label: "معرّف حدث إضافة السلة",
        hint: "tw-XXXXX-XXXXX لحدث «Add to cart». اختياري: فارغ لا يُرسل.",
      },
      leadEventId: {
        label: "معرّف حدث الاستفسار",
        hint: "tw-XXXXX-XXXXX لحدث «Lead». اختياري: يُرسل اسم الحدث وحده بلا شيء مما كُتب في النموذج.",
      },
    },
    pixelHints: {
      meta: "أرقام: Events Manager ← مصادر البيانات ← مجموعة البيانات ← الإعدادات.",
      snap: "UUID: Ads Manager ← Events Manager ← البكسل.",
      tiktok: "رمز بحروف كبيرة وأرقام: Ads Manager ← الأدوات ← Events ← Web Events.",
      x: "خمسة محارف: ads.x.com ← الأدوات ← Events Manager ← البكسل (‏twq('config','XXXXX') في شيفرته الأساسية).",
    },
    sendHashedPhone: "إرسال الجوال المجزّأ",
    sendHashedPhoneHint:
      "مع موافقة الزائر على الإعلانات وحدها: جوال الطلب بعد SHA-256، لتربط المنصة الشراء بالإعلان. أطفئه لتعتمد على المعرّفات التقنية وحدها.",
    testEventCode: "رمز أحداث الاختبار",
    testEventCodeHint:
      "من «اختبار الأحداث» في لوحة المنصة. يُستعمل لحدث الاختبار وحده، لا مع الأحداث الحية.",
    secret: "المفتاح الخادمي",
    secretHints: {
      ga4: "سر Measurement Protocol: التدفق نفسه ← أسرار واجهة Measurement Protocol ← إنشاء.",
      meta: "رمز Conversions API: مجموعة البيانات ← الإعدادات ← Conversions API ← إنشاء رمز وصول.",
      snap: "Ads Manager ← Business Details ← Conversions API Tokens ← Generate Token.",
      tiktok: "البكسل ← الإعدادات ← Events API ← إنشاء رمز وصول.",
    },
    /** {last4}: آخر أربعة محارف من المفتاح المحفوظ */
    secretSet: "مضبوط · آخره {last4}. اتركه فارغًا ليبقى كما هو.",
    secretUnset: "غير مضبوط: لا إرسال خادمي حتى يُضبط.",
    secretReadOnly: "كتابة المفتاح للمالك وحده.",
    secretClear: "احذف المفتاح المحفوظ",
    browserOnly: "لا مفتاح خادمي لهذه المنصة: تعمل في المتصفح وحده.",
    browserOnlyX:
      "لا مفتاح خادمي لـX: واجهة تحويلاته الخادمية تحتاج تطبيق مطوّر معتمدًا لـAds API، فالشراء يصل من البكسل في صفحة الطلب المدفوع.",
    submit: "احفظ الإعداد",
  },
  test: {
    title: "حدث اختبار",
    lead: "يرسل حدثًا بلا بيانات عميل إلى نقطة الاختبار أو برمز الاختبار، ويظهر في السجل بردّ المنصة.",
    leadByProvider: {
      ga4: "إلى نقطة التحقق في GA4 (لا يُسجَّل في التقارير).",
      meta: "حدث مخصّص MasarTestEvent برمز الاختبار، يظهر في «اختبار الأحداث». ميتا لا تُسقط أحداث الاختبار من القياس.",
      snap: "إلى نقطة التحقق في سناب (لا يُحتسب).",
      tiktok: "ViewContent برمز الاختبار، يظهر في Test Events ولا يُحفظ حدثًا حيًّا.",
    },
    submit: "أرسل حدث اختبار",
  },
  gtmContainerNote:
    "الوسوم غير Google داخل الحاوية (بكسلات أو سكربتات تضيفها أنت) مسؤوليتك: اضبط لكل منها «فحوص الموافقة الإضافية» في Tag Manager، وأضف مضيفها إلى CSP بقرار، وإلا تحجبه السياسة.",
  xContainerNote:
    "لا تضف وسم X الأساسي ولا أحداثه داخل حاوية GTM أيضًا: يُحمَّل البكسل مرتين ويُحسب الحدث مرتين. إعداده هنا وحده يكفي.",
  gtmOverlap:
    "GTM مفعَّل مع Google Analytics أو Google Ads هنا: إن كان الوسم نفسه داخل الحاوية أيضًا فسيُقاس كل حدث مرتين. فعّله في مكان واحد.",
  log: {
    title: "آخر الإرسالات",
    lead: "الإرسالات الخادمية وأحداث الاختبار، الأحدث أولًا. بلا حمولة ولا بيانات عميل.",
    emptyTitle: "لا إرسالات بعد",
    emptyLead: "تظهر هنا بعد أول شراء مدفوع لمنصة مفعّلة، أو بعد حدث اختبار.",
    columns: {
      time: "الوقت",
      provider: "المنصة",
      event: "الحدث",
      order: "الطلب",
      status: "الحالة",
      attempts: "المحاولات",
      response: "الرد",
    },
    kinds: { live: "حي", test: "اختبار" },
    statuses: { pending: "بالانتظار", sent: "أُرسل", dead: "فشل نهائيًا", skipped: "لم يُرسل" },
    reasons: {
      disabled: "المنصة متوقفة",
      no_secret: "لا مفتاح خادمي",
      secret_unreadable: "المفتاح لا يُفك: أعد إدخاله",
      no_order_context: "لا موافقة مختومة مع الطلب",
      no_consent: "لا موافقة على فئتها",
      no_client_id: "لا معرّف عميل GA4 مع الطلب",
      config_incomplete: "الإعداد ناقص",
      too_old: "أقدم مما تقبله المنصة",
      timeout: "انتهت المهلة",
      network: "تعذّر الاتصال",
      validation_failed: "رفضته نقطة التحقق",
      api_invalid: "رفضته المنصة",
      retention_purged: "انقضت مدة الاحتفاظ قبل الإرسال",
    },
  },
} as const;

export const integrationsErrorsAr = {
  "tracking.invalid_containerId": "معرّف الحاوية بصيغة غير صحيحة (GTM-XXXXXXX).",
  "tracking.required_containerId": "اكتب معرّف الحاوية قبل التفعيل.",
  "tracking.invalid_measurementId": "معرّف القياس بصيغة غير صحيحة (G-XXXXXXXXXX).",
  "tracking.required_measurementId": "اكتب معرّف القياس قبل التفعيل.",
  "tracking.invalid_conversionId": "معرّف التحويل بصيغة غير صحيحة (AW- ثم أرقام).",
  "tracking.required_conversionId": "اكتب معرّف التحويل قبل التفعيل.",
  "tracking.invalid_conversionLabel": "تسمية التحويل بصيغة غير صحيحة.",
  "tracking.required_conversionLabel": "اكتب تسمية التحويل قبل التفعيل.",
  "tracking.invalid_pixelId": "معرّف البكسل بصيغة غير صحيحة لهذه المنصة.",
  "tracking.required_pixelId": "اكتب معرّف البكسل قبل التفعيل.",
  "tracking.invalid_purchaseEventId": "معرّف حدث الشراء بصيغة غير صحيحة (tw-XXXXX-XXXXX).",
  "tracking.required_purchaseEventId": "اكتب معرّف حدث الشراء قبل التفعيل.",
  "tracking.pixel_mismatch_purchaseEventId": "معرّف حدث الشراء لبكسل آخر: وسطه يطابق معرّف البكسل.",
  "tracking.invalid_addToCartEventId": "معرّف حدث إضافة السلة بصيغة غير صحيحة (tw-XXXXX-XXXXX).",
  "tracking.pixel_mismatch_addToCartEventId":
    "معرّف حدث إضافة السلة لبكسل آخر: وسطه يطابق معرّف البكسل.",
  "tracking.invalid_leadEventId": "معرّف حدث الاستفسار بصيغة غير صحيحة (tw-XXXXX-XXXXX).",
  "tracking.pixel_mismatch_leadEventId": "معرّف حدث الاستفسار لبكسل آخر: وسطه يطابق معرّف البكسل.",
  "tracking.invalid_test_code": "رمز الاختبار حروف وأرقام فقط، من 4 إلى 40.",
  "tracking.invalid_secret": "المفتاح بصيغة غير متوقعة: الصقه كما هو بلا مسافات.",
  "tracking.no_secret": "لا مفتاح خادمي محفوظ لهذه المنصة.",
  "tracking.secret_unreadable": "المفتاح المحفوظ لا يُفك (تغيّر مفتاح اللوحة). أعد إدخاله.",
  "tracking.no_test_event_code": "اكتب رمز أحداث الاختبار من لوحة المنصة واحفظه أولًا.",
  "tracking.config_incomplete": "أكمل معرّفات المنصة واحفظها أولًا.",
  "tracking.not_configured": "احفظ إعداد المنصة أولًا.",
  "tracking.test_failed": "رفضت المنصة حدث الاختبار. الرمز والسبب في السجل أدناه.",
  "tracking.too_many_tests": "محاولات كثيرة. انتظر عشر دقائق ثم حاول.",
} as const;

export const integrationsNoticesAr = {
  tracking_saved: "حُفظ الإعداد. يسري على الموقع خلال ثوانٍ.",
  tracking_unchanged: "لا تغيير عن المحفوظ.",
  tracking_test_sent: "أُرسل حدث الاختبار وقبلته المنصة. تحقق من ظهوره في لوحتها.",
} as const;

export const integrationsAuditAr = {
  platforms: {
    gtm: integrationsAr.providers.gtm.name,
    ga4: integrationsAr.providers.ga4.name,
    google_ads: integrationsAr.providers.google_ads.name,
    meta: integrationsAr.providers.meta.name,
    snap: integrationsAr.providers.snap.name,
    tiktok: integrationsAr.providers.tiktok.name,
    x: integrationsAr.providers.x.name,
  },
  actions: { tracking_integration_updated: "عُدّل إعداد منصة ربط" },
  details: {
    platform: "المنصة",
    testEventCodeChanged: "تغيّر رمز الاختبار",
    secretChanged: "تغيّر المفتاح الخادمي",
  },
  changedFields: {
    containerId: "معرّف الحاوية",
    measurementId: "معرّف القياس",
    conversionId: "معرّف التحويل",
    conversionLabel: "تسمية التحويل",
    pixelId: "معرّف البكسل",
    purchaseEventId: "معرّف حدث الشراء",
    addToCartEventId: "معرّف حدث إضافة السلة",
    leadEventId: "معرّف حدث الاستفسار",
    sendHashedPhone: "إرسال الجوال المجزّأ",
  },
} as const;
