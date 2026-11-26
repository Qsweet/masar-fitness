import { salesOrderActionsAr } from "./sales-actions-ar";
import { salesCustomersAr } from "./sales-customers-ar";
import { salesOrdersAr } from "./sales-orders-ar";
import { salesStatusesAr } from "./statuses-ar";

/**
 * نصوص مجموعة «المبيعات» في اللوحة (ADMIN_A2_SALES §12). تُركَّب في `adminAr.sales`. ما يُبنى من
 * المجموعة اليوم: الطلبات والعملاء؛ الكتالوج والعروض وإعدادات البيع تُضاف مع حزمها.
 */
export const salesAr = {
  nav: { orders: "الطلبات", customers: "العملاء" },
  breadcrumbs: {
    group: "المبيعات",
    order: "تفصيل الطلب",
    cancel: "إلغاء الطلب",
    settle: "دفع يدوي",
    customer: "صفحة العميل",
  },
  errorPage: {
    title: "تعذّر عرض هذه الصفحة",
    lead: "حدث عطل غير متوقع وسُجّل. حاول من جديد، وإن تكرر أبلغ مدير النظام.",
    retry: "حاول من جديد",
  },
  statuses: salesStatusesAr,
  orders: { ...salesOrdersAr, ...salesOrderActionsAr },
  customers: salesCustomersAr,
} as const;

/** أسباب أخطاء المبيعات (`DomainError.reason`) بنصوصها. تُدمج في `adminAr.errors`. */
export const salesErrorsAr = {
  "order.not_found": "الطلب غير موجود.",
  "order.not_cancellable":
    "هذا الطلب لا يُلغى: دُفع أو انتهت مهلته أو أُلغي من قبل. حدّث الصفحة لترى حالته.",
  "order.cancel_blocked_by_live_attempt":
    "العميل في صفحة الدفع الآن. انتظر حتى تنتهي محاولته ثم حاول.",
  "order.cancel_reason_invalid": "اختر سببًا من القائمة.",
  "order.not_payable": "هذا الطلب لا يُدفع: انتهى أو أُلغي. يحتاج العميل طلبًا جديدًا.",
  "order.payment_window_passed":
    "انتهت مهلة الدفع لهذا الطلب، فلا يُسجَّل له دفع. يحتاج العميل طلبًا جديدًا.",
  "order.already_paid": "هذا الطلب مدفوع من قبل. لم يُسجَّل شيء.",
  "order.settle_blocked_by_live_attempt":
    "العميل يدفع الآن عبر بوابة الدفع. انتظر نتيجة محاولته قبل تسجيل دفع يدوي.",
  "orders.settle_preview_refused":
    "الشراء في وضع المعاينة: طلباته للعرض فقط ولا يُسجَّل عليها دفع.",
  "orders.settle_confirmation_required": "أكّد أنك تحققت من وصول المبلغ.",
  "orders.settle_token_invalid":
    "انتهت صلاحية نموذج التأكيد أو تغيّرت بياناته. أدخل البيانات من جديد.",
  "orders.settle_too_many_attempts": "محاولات كثيرة لتسجيل الدفع. انتظر عشر دقائق ثم حاول.",
  "payment.amount_mismatch": "المبلغ المستلم لا يساوي إجمالي الطلب. لا يُسجَّل دفع جزئي ولا زائد.",
  "payment.currency_mismatch": "عملة الدفعة لا تطابق عملة الطلب.",
  "payment.already_used": "هذه الدفعة مسجّلة على طلب آخر.",
  "manual_payment.method_invalid": "اختر طريقة الدفع من القائمة.",
  "manual_payment.reference_invalid":
    "المرجع الخارجي من 3 إلى 64 محرفًا، وفيه ثلاثة أحرف أو أرقام على الأقل.",
  "manual_payment.reference_used":
    "هذا المرجع مسجَّل من قبل على طلب آخر. المرجع الواحد لا يسوّي طلبين: تحقق من رقم الحوالة أو السند.",
  "manual_payment.received_on_invalid": "تاريخ الاستلام يجب أن يكون بين يوم إنشاء الطلب واليوم.",
  "manual_payment.note_too_long": "الملاحظة أطول من 500 محرف.",
  "amount.invalid_format": "اكتب المبلغ بالأرقام، مثل 1499 أو 1,499.50.",
  "amount.too_many_decimals": "خانتان عشريتان على الأكثر.",
  "amount.negative": "المبلغ لا يكون سالبًا.",
  "amount.too_large": "المبلغ أكبر من الحد المقبول.",
  "date.invalid_format": "اكتب التاريخ كاملًا.",
  "date.invalid": "هذا التاريخ غير صحيح.",
  "customer.not_found": "لا عميل بهذا الرقم.",
  "customers.mobile_invalid": "اكتب رقم جوال سعوديًا كاملًا، مثل 05XXXXXXXX.",
  "customers.too_many_lookups": "عمليات بحث كثيرة. انتظر عشر دقائق ثم حاول.",
  "customers.too_many_reveals": "كشفتَ أرقامًا كثيرة في وقت قصير. انتظر عشر دقائق ثم حاول.",
  "sales.invalid_request": "طلب غير صالح. حدّث الصفحة وحاول من جديد.",
} as const;

export const salesNoticesAr = {
  order_cancelled: "أُلغي الطلب.",
  manual_payment_recorded: "سُجّل الدفع وفُعّل الطلب.",
} as const;

/** أحداث البيع والدفع في سجل التدقيق والخط الزمني. المفاتيح رموز يكتبها الكود. */
export const salesAuditActionsAr = {
  order_created: "أُنشئ الطلب",
  order_expired: "انتهت مهلة الطلب",
  order_cancelled: "أُلغي الطلب",
  order_fulfilled: "اكتمل الطلب",
  payment_verified: "سُجّل الدفع",
  payment_rejected: "رُفضت دفعة",
  membership_created: "أُنشئ الاشتراك",
  assessment_requested: "طُلب تقييم",
  payment_attempt_created: "بدأت محاولة دفع",
  payment_attempt_session_opened: "فُتحت جلسة الدفع",
  payment_attempt_pending: "محاولة الدفع بانتظار العميل",
  payment_attempt_authorized: "حُجز المبلغ",
  payment_attempt_captured: "حُصّل المبلغ",
  payment_attempt_failed: "فشلت محاولة الدفع",
  payment_attempt_voided: "عُكست محاولة الدفع",
  payment_attempt_expired: "انتهت جلسة الدفع",
  payment_attempt_refunded: "استُردت محاولة الدفع",
  payment_attempt_settled: "سُوّيت محاولة الدفع",
  manual_payment_recorded: "سُجّل دفع يدوي",
  phone_revealed: "كُشف جوال عميل",
} as const;

/** تسميات مفاتيح `data` في أسطر تدقيق البيع. */
export const salesAuditDetailsAr = {
  reference: "المرجع",
  orderReference: "مرجع الطلب",
  orderId: "الطلب",
  source: "من",
  externalReference: "المرجع الخارجي",
  receivedOn: "تاريخ الاستلام",
  amountMinor: "المبلغ بالهللة",
  currency: "العملة",
  provider: "المزوّد",
  providerPaymentId: "معرّف الدفعة",
  startsOn: "يبدأ",
  endsOn: "ينتهي",
} as const;

/** قيم تُترجم في أسطر تدقيق البيع: مصدر كشف الجوال، واسم «المزوّد» (المجهول باسمه العام لا برمزه). */
export const salesAuditValuesAr = {
  sources: { order: "تفصيل طلب", customer: "صفحة العميل" },
  providers: salesStatusesAr.payment.providers,
  unknownProvider: salesStatusesAr.payment.unknownProvider,
} as const;
