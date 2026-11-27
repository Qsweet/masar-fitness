/**
 * نصوص حالة النسخ الاحتياطي في اللوحة (docs/BACKUP.md §9). تُركَّب في `adminAr.backup`.
 * المفاتيح أسباب ثابتة يحسبها `backupAlert` و`backupHealth` في @masar/domain.
 */
export const backupAr = {
  alertTitle: "النسخ الاحتياطي يحتاج انتباهًا",
  /** {reason}: سبب من `reasons`. */
  alertBody:
    "قاعدة البيانات والصور المرفوعة على هذا الخادم وحده، وعطل فيه يمحوها. {reason} الخطوات في docs/BACKUP.md على الخادم.",
  reasons: {
    /** {age}: «قبل 40 ساعة»، {max}: الحد بالساعات. */
    stale: "آخر نسخة ناجحة خارج الخادم كانت {age}، والحد {max} ساعة.",
    never: "لم تنجح أي نسخة خارج الخادم بعد.",
    unmonitored: "النسخ اليومي المشفر خارج الخادم غير مثبَّت.",
    unreadable: "سجل النسخ الاحتياطي على الخادم لا يُقرأ.",
    check_failed: "فشل آخر فحص أسبوعي لسلامة النسخ المخزنة.",
  },
  system: {
    label: "النسخ الاحتياطي",
    /** {age}: «قبل 3 ساعات». */
    lastSuccess: "آخر نسخة {age}",
    lastRunFailed: "وفشلت المحاولة التالية",
    never: "لم تنجح نسخة بعد",
    unmonitored: "غير مثبَّت",
    declared: "معلن يدويًا، بلا سجل آلي",
    unreadable: "السجل لا يُقرأ",
    checkFailed: "فشل فحص السلامة",
    drill: "آخر تجربة استرجاع",
    drillNever: "لم تُجرَ بعد",
  },
} as const;
