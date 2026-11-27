/** نصوص مكتبة الصور في اللوحة (docs/ADMIN_A3_SLIDER.md §6، §11). تُركَّب في `adminAr.media`. */
export const mediaAr = {
  title: "الصور",
  lead: "صور الشرائح. تُعاد ترميزًا على الخادم بعدة مقاسات وبلا بيانات الموقع أو الكاميرا.",
  uploadTitle: "ارفع صورة",
  /** {size}: الحد بالميغابايت، {min}: أدنى ضلع. */
  uploadLead: "JPEG أو PNG أو WebP حتى {size} ميغابايت، وكل ضلع {min} بكسل على الأقل.",
  file: "الملف",
  submit: "ارفع",
  uploadsOff:
    "الرفع غير مفعّل على هذا الخادم. ما رُفع من قبل يبقى ظاهرًا ويُستعمل. التفعيل من إعداد الخادم (docs/DEPLOYMENT.md).",
  noBackupTitle: "لا نسخ احتياطي",
  noBackup:
    "الصور المرفوعة موجودة على هذا الخادم وحده، وعطل فيه يمحوها مع قاعدة البيانات. أعدّوا نسخة يومية مشفرة خارج الخادم قبل الاعتماد عليها.",
  gridTitle: "المكتبة",
  /** {count}: عدد الصور. */
  gridLead: "{count} صورة. الأحدث أولًا.",
  emptyTitle: "لا صور بعد",
  emptyLead: "ارفع صورة لتستعملها في شريحة.",
  /** {width}×{height}: الأبعاد. */
  dimensions: "{width}×{height}",
  used: "مستعملة",
  unused: "غير مستعملة",
  open: "افتح",
  /** {name}: اسم الملف، لقارئ الشاشة. */
  openLabel: "افتح {name}",
  asset: {
    title: "صورة",
    facts: {
      name: "اسم الملف",
      dimensions: "الأبعاد",
      size: "حجم الأصل",
      uploaded: "رُفعت",
      variants: "النسخ",
    },
    /** {widths}: العروض. */
    variants: "AVIF وWebP بالعروض {widths}",
    usageTitle: "أين تُستعمل",
    usageNone: "لا تستعملها شريحة في المسودة ولا أي إصدار.",
    /** {list}: مواضع الشرائح. */
    usageDraft: "في المسودة: {list}",
    /** {list}: أرقام الإصدارات. */
    usageReleases: "في الإصدارات: {list}",
    deleteTitle: "حذف نهائي",
    deleteLead: "يحذف الصورة وكل نسخها من الخادم. لا رجعة فيه.",
    deleteBlocked:
      "لا تُحذف: صورة تستعملها شريحة في المسودة أو في أي إصدار تبقى، فالاسترجاع يحتاجها.",
    deleteOwner: "الحذف النهائي للمالك وحده.",
    deleteSubmit: "احذف الصورة نهائيًا",
    /** {kb}: الحجم بالكيلوبايت. */
    kilobytes: "{kb} ك.ب",
  },
} as const;

/** أسباب رفض الشريط والمكتبة (`slider.*`، `media.*`) بنصوصها. تُدمج في `adminAr.errors`. */
export const sliderErrorsAr = {
  "slider.image_required": "اختر صورة للحاسوب.",
  "slider.image_too_small": "الصورة أصغر من المطلوب: العرض {name} بكسل على الأقل.",
  "slider.image_unknown": "الصورة غير موجودة في المكتبة. حدّث الصفحة واختر غيرها.",
  "slider.alt_required": "اكتب النص البديل، أو علّم الصورة زخرفية.",
  "slider.multiline": "النص سطر واحد: احذف السطر الجديد.",
  "slider.brace": "احذف القوس المعقوف { أو }.",
  "slider.too_long": "النص أطول من {name} محرف.",
  "slider.copy_lint": "خطأ كتابة: {name}.",
  "slider.cta_without_link": "الزر يحتاج رابطًا. اختر رابطًا أو احذف تسمية الزر.",
  "slider.cta_required": "اكتب تسمية الزر: النقر على الزر وحده.",
  "slider.link_name_missing":
    "الرابط بلا اسم في إحدى اللغتين. اكتب عنوانًا أو تسمية زر، أو نصًا بديلًا للصورة.",
  "slider.link_required": "اختر الصفحة أو اكتب الرابط.",
  "slider.link_unknown": "الصفحة غير معروفة في الموقع الآن. اختر غيرها.",
  "slider.link_https_only": "الرابط الخارجي يبدأ بـhttps:// فقط.",
  "slider.link_invalid": "الرابط غير صالح: نطاق باسمه، بلا منفذ ولا اسم مستخدم ولا مسافات.",
  "slider.link_too_long": "الرابط أطول من 500 محرف.",
  "slider.link_kind_unknown": "اختر نوع الرابط.",
  "slider.click_target_unknown": "اختر ما يُنقر.",
  "slider.schedule_invalid": "الوقت غير صالح.",
  "slider.schedule_order": "النهاية بعد البداية.",
  "slider.interval_invalid": "المدة من 4 إلى 15 ثانية.",
  "slider.too_many": "بلغ الشريط أقصى عدد للشرائح.",
  "slider.not_found": "الشريحة غير موجودة. ربما أزالها غيرك.",
  "slider.move_edge": "الشريحة في طرف الترتيب.",
  "slider.stale_edit":
    "عدّل غيرك هذه الشريحة أو الإعدادات بعد فتحك الصفحة. حدّث الصفحة لترى نسخته، ثم أعد تعديلك.",
  "slider.no_changes": "لا تغيير لحفظه.",
  "content.slider_invalid":
    "في الشريط شريحة لا تُنشر (رابط إلى صفحة لم تعد موجودة، أو نص لا يمر بالتحقق). افتح الشريط وصحّحها.",
  "media.not_found": "الصورة غير موجودة.",
  "media.in_use": "الصورة مستعملة في شريحة أو إصدار، فلا تُحذف.",
  "media.no_file": "اختر ملف صورة.",
  "media.too_large": "الملف أكبر من 8 ميغابايت.",
  "media.too_small": "الصورة صغيرة: كل ضلع 640 بكسل على الأقل.",
  "media.too_large_pixels": "الصورة أكبر من الحد: كل ضلع 8000 بكسل على الأكثر.",
  "media.type_unsupported": "النوع غير مقبول: JPEG أو PNG أو WebP فقط (لا SVG ولا GIF ولا HEIC).",
  "media.animated": "الصور المتحركة غير مقبولة.",
  "media.unreadable": "تعذّرت قراءة الصورة: الملف تالف أو ليس صورة.",
  "media.rate_limited": "رفعت صورًا كثيرة في وقت قصير. انتظر دقائق ثم أعد المحاولة.",
  "media.store_failed": "تعذّر حفظ الصورة على الخادم. أبلغ مدير النظام.",
} as const;

/** تنبيهات النجاح (`?done=`). تُدمج في `adminAr.notices`. */
export const sliderNoticesAr = {
  content_slide_created: "أُضيفت الشريحة إلى المسودة. لا يتغير الموقع حتى النشر.",
  content_slide_updated: "حُفظت الشريحة في المسودة. لا يتغير الموقع حتى النشر.",
  content_slide_moved: "تغيّر ترتيب الشرائح في المسودة.",
  content_slide_removed: "أُزيلت الشريحة من المسودة.",
  content_slider_settings_saved: "حُفظت إعدادات الشريط في المسودة.",
  media_asset_uploaded: "رُفعت الصورة وجُهزت نسخها.",
  media_asset_exists: "هذه الصورة في المكتبة من قبل.",
  media_asset_deleted: "حُذفت الصورة نهائيًا.",
} as const;

/** أحداث الشريط والمكتبة في سجل التدقيق. تُدمج في `audit.salesActions`. */
export const sliderAuditActionsAr = {
  content_slide_created: "أُضيفت شريحة إلى المسودة",
  content_slide_updated: "عُدّلت شريحة في المسودة",
  content_slide_moved: "تحرّكت شريحة في المسودة",
  content_slide_removed: "أُزيلت شريحة من المسودة",
  content_slider_settings_saved: "حُفظت إعدادات الشريط",
  media_asset_uploaded: "رُفعت صورة",
  media_asset_deleted: "حُذفت صورة",
} as const;

/** تسميات مفاتيح `data` في أسطر تدقيق الشريط والمكتبة. */
export const sliderAuditDetailsAr = {
  position: "الموضع",
  fields: "الحقول",
  autoplay: "الانتقال التلقائي",
  intervalMs: "المدة بالمللي ثانية",
  width: "العرض",
  height: "الارتفاع",
  bytes: "الحجم بالبايت",
} as const;
