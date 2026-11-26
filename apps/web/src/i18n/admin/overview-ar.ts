import { orderStatusesAr } from "./statuses-ar";

/** نصوص «نظرة عامة» في اللوحة. جزء من قاموس اللوحة العربي (ar.ts)، مفصول لحجمه. */
export const overviewAr = {
  title: "نظرة عامة",
  /** {name}: اسم الموظف. {date}: تاريخ اليوم بتقويم النادي. */
  description: "أهلًا {name}. أرقام اليوم {date} حتى هذه اللحظة.",
  kpis: {
    label: "أرقام اليوم",
    created: "طلبات اليوم",
    awaiting: "بانتظار الدفع الآن",
    awaitingHint: "طلبات مفتوحة لم تبلغ مهلتها",
    paid: "مدفوعة اليوم",
    revenue: "إيراد اليوم",
    revenueHint: "ما دُفع فعلًا، شامل الضريبة",
    /** {percent}: النسبة بعلامتها، معزولة الاتجاه («50%»). */
    up: "أعلى من أمس بنسبة {percent}",
    down: "أقل من أمس بنسبة {percent}",
    trend: "آخر 7 أيام",
  },
  chart: {
    title: "الطلبات في 14 يومًا",
    description: "عدد الطلبات المنشأة كل يوم، بتقويم النادي.",
    /** {count}: مجموع الفترة. */
    total: "{count} طلبًا في الفترة",
    day: "اليوم",
    orders: "الطلبات",
    emptyTitle: "لا طلبات في آخر 14 يومًا",
    emptyLead: "يظهر الرسم هنا مع أول طلب يُنشأ من الموقع.",
  },
  orders: {
    title: "آخر الطلبات",
    columns: {
      reference: "المرجع",
      customer: "الجوال",
      item: "الباقة",
      total: "الإجمالي",
      status: "الحالة",
      time: "الوقت",
    },
    emptyTitle: "لا طلبات بعد",
    emptyLead: "تظهر الطلبات هنا فور إنشائها من صفحة الشراء.",
    phoneMask: "•••• ",
  },
  activity: {
    title: "آخر النشاط",
    all: "كل السجل",
    emptyTitle: "لا نشاط مسجَّل بعد",
    /** {actor}: الفاعل. {subject}: من وقع عليه الحدث. بصيغة المصدر: لا تفترض جنس الفاعل. */
    sentences: {
      login_succeeded: "دخول {actor} إلى اللوحة",
      login_failed: "محاولة دخول فاشلة: {subject}",
      account_locked: "قفل حساب {subject} بعد محاولات فاشلة",
      logout: "خروج {actor}",
      mfa_verified: "إتمام {actor} التحقق بخطوتين",
      mfa_failed: "رمز تحقق خاطئ لحساب {subject}",
      mfa_enrolled: "تفعيل {actor} التحقق بخطوتين",
      mfa_reset: "إعادة ضبط التحقق بخطوتين لـ{subject} بواسطة {actor}",
      recovery_code_used: "دخول {actor} برمز استرجاع",
      password_changed: "تغيير {actor} كلمة المرور",
      password_reset: "كلمة مرور مؤقتة لـ{subject} بواسطة {actor}",
      staff_created: "إنشاء حساب {subject} بواسطة {actor}",
      role_changed: "تغيير دور {subject} بواسطة {actor}",
      staff_disabled: "تعطيل حساب {subject} بواسطة {actor}",
      staff_enabled: "تفعيل حساب {subject} بواسطة {actor}",
      session_revoked: "إلغاء جلسة لـ{actor}",
    },
    /** لأحداث بلا قالب (أحداث البيع): {action} رمز الحدث. */
    fallback: "{action}: {subject} ({actor})",
  },
  system: {
    title: "حالة النظام",
    checkout: "الشراء الإلكتروني",
    checkoutStates: { open: "مفتوح", preview: "معاينة بلا دفع", closed: "مغلق" },
    payments: "الدفع",
    paymentsOff: "غير مربوط",
    /** {provider}: اسم المزوّد. */
    paymentsTest: "تجريبي ({provider})",
    indexing: "فهرسة محركات البحث",
    indexingStates: { on: "مفتوحة", off: "مغلقة" },
    version: "الإصدار",
    mfa: "التحقق بخطوتين",
    /** {enrolled} من {active} حسابًا نشطًا. */
    mfaCoverage: "{enrolled} من {active} حسابًا نشطًا",
  },
  orderStatuses: orderStatusesAr,
} as const;
