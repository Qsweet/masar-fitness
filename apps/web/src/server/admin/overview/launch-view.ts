import { launchSummary, type LaunchEntry, type LaunchItem } from "@masar/domain";

/** ما تعرضه قائمة الإطلاق، ومنطق ملخصها الصرف (يُختبر بلا قاعدة). */
export interface LaunchView {
  /** البنود الثمانية كلها بحالاتها. */
  readonly entries: readonly LaunchEntry[];
  /** البنود التي يملك هذا الموظف فعلها (زرها). */
  readonly actionable: readonly LaunchItem[];
  /** حال بوابة الدفع لشرح بندها: لا مزوّد، أو بوابة اختبار. */
  readonly payments: "off" | "test";
}

export interface LaunchCounts {
  readonly done: number;
  readonly total: number;
  /** مفتوحة (فعل أو تحذير) يفعلها هذا الموظف. */
  readonly mine: number;
  /** مفتوحة لا يفعلها هو: بيد المالك. */
  readonly owner: number;
  /** تنتظر مرحلتها أو قرار المالك. */
  readonly waiting: readonly LaunchEntry[];
  /** لا بند مفتوح لأحد: القائمة شريط رفيع. */
  readonly settled: boolean;
}

/** الملخص الواحد الذي تقوله التحية والبطاقة معًا. */
export function launchCounts(view: LaunchView): LaunchCounts {
  const summary = launchSummary(view.entries);
  const mine = summary.open.filter((entry) => view.actionable.includes(entry.item)).length;
  return {
    done: summary.done,
    total: summary.total,
    mine,
    owner: summary.open.length - mine,
    waiting: summary.waiting,
    settled: summary.settled,
  };
}
