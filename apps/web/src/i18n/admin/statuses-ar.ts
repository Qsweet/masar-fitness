/**
 * نصوص حالات البيع: مصدر واحد تستعمله «نظرة عامة» وقوائم المبيعات والتفصيل والخط الزمني. المفاتيح
 * رموز يكتبها الكود (حالات المجال والقاعدة)، والاختبار يطابقها بقوائمها.
 */
export const orderStatusesAr = {
  pending_payment: "بانتظار الدفع",
  paid: "مدفوع",
  fulfilled: "مكتمل",
  expired: "انتهت مهلته",
  cancelled: "ملغى",
  partially_refunded: "مسترد جزئيًا",
  refunded: "مسترد",
} as const;

export const salesStatusesAr = {
  order: orderStatusesAr,
  membership: {
    scheduled: "مجدول",
    active: "نشط",
    frozen: "مجمَّد",
    expired: "منتهٍ",
    cancelled: "ملغى",
  },
  attempt: {
    created: "بدأت",
    pending: "بانتظار العميل",
    authorized: "محجوز",
    captured: "محصَّل",
    failed: "فشلت",
    voided: "معكوسة",
    expired: "انتهت جلستها",
    refunded: "مستردة",
  },
  incident: {
    late_payment_not_payable: "دفعة وصلت بعد انتهاء الطلب",
    amount_mismatch: "مبلغ لا يطابق الطلب",
    currency_mismatch: "عملة لا تطابق الطلب",
    order_already_paid: "دفعة ثانية على طلب مدفوع",
    payment_already_used: "دفعة مستعملة لطلب آخر",
    coupon_applied_by_provider: "خصم طبّقه المزوّد",
    unknown_reference: "مرجع لا يطابق محاولتنا",
    provider_reversed: "عكس المزوّد الدفعة",
    stuck_pending: "محاولة عالقة",
    capture_blocked: "تحصيل محجوب",
    capture_failed: "فشل التحصيل",
  },
  refund: {
    requested: "مطلوب",
    approved: "موافَق عليه",
    rejected: "مرفوض",
    processing: "قيد التنفيذ",
    completed: "مكتمل",
    failed: "فشل",
  },
  itemKind: {
    membership: "اشتراك",
    addon: "إضافة",
    digital_program: "برنامج رقمي",
    assessed_service: "خدمة بتقييم",
  },
  startRule: { on_payment: "يبدأ يوم الدفع", on_first_visit: "يبدأ من أول زيارة" },
  discountSource: { automatic: "عرض تلقائي", coupon: "كوبون" },
  manualMethod: { bank_transfer: "حوالة بنكية", paid_at_club: "مدفوع في النادي" },
  /** طريقة الدفع في القوائم: اليدوي باسمه، وغيره باسم المزوّد كما هو. */
  manualProvider: "دفع يدوي",
  unpaid: "لم يُدفع",
} as const;
