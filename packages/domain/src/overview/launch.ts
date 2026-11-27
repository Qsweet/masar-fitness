import type { BackupState } from "../backup/health";

/**
 * «جهّز النادي للبيع الإلكتروني» (ADMIN_REDESIGN §5.1): كل بند من حالة قائمة في النظام تُقرأ على الخادم،
 * لا علَم يدوي. الحالات صادقة: مكتمل، أو فعل مطلوب، أو تحذير (موجود ومعطوب)، أو «لاحقًا» (يعتمد على
 * مرحلة لم تُبنَ)، أو «قرار المالك» (لا يفعله أحد غيره ولا زر له هنا).
 */
export const LAUNCH_ITEMS = [
  "mfa",
  "plans",
  "salesSettings",
  "content",
  "slider",
  "backup",
  "payments",
  "checkout",
] as const;
export type LaunchItem = (typeof LAUNCH_ITEMS)[number];
export type LaunchItemState = "done" | "todo" | "warn" | "later" | "owner";

export interface LaunchInput {
  readonly mfa: { readonly active: number; readonly enrolled: number };
  readonly sellablePlans: number;
  readonly salesSettings: { readonly windowDecided: boolean; readonly startDecided: boolean };
  readonly publishedRelease: boolean;
  /** شرائح سارية الآن في الإصدار المنشور. */
  readonly liveSlides: number;
  readonly backup: {
    readonly state: BackupState;
    /** آخر دورة أو آخر فحص سلامة فشل. */
    readonly failing: boolean;
  };
  readonly payments: "off" | "test" | "live";
  readonly checkout: "open" | "preview" | "closed";
}

export interface LaunchEntry {
  readonly item: LaunchItem;
  readonly state: LaunchItemState;
}

function backupState({ state, failing }: LaunchInput["backup"]): LaunchItemState {
  if (state === "unmonitored") {
    return "todo";
  }
  return state === "fresh" && !failing ? "done" : "warn";
}

const DERIVE: Readonly<Record<LaunchItem, (input: LaunchInput) => LaunchItemState>> = {
  mfa: ({ mfa }) => (mfa.active > 0 && mfa.enrolled >= mfa.active ? "done" : "todo"),
  plans: ({ sellablePlans }) => (sellablePlans > 0 ? "done" : "todo"),
  salesSettings: ({ salesSettings }) =>
    salesSettings.windowDecided && salesSettings.startDecided ? "done" : "todo",
  content: ({ publishedRelease }) => (publishedRelease ? "done" : "todo"),
  slider: ({ liveSlides }) => (liveSlides > 0 ? "done" : "todo"),
  backup: ({ backup }) => backupState(backup),
  payments: ({ payments }) => (payments === "live" ? "done" : "later"),
  checkout: ({ checkout }) => (checkout === "open" ? "done" : "owner"),
};

/** البنود بالترتيب الثابت وحالة كلٍّ. */
export function launchChecklist(input: LaunchInput): LaunchEntry[] {
  return LAUNCH_ITEMS.map((item) => ({ item, state: DERIVE[item](input) }));
}

const OPEN_STATES: readonly LaunchItemState[] = ["todo", "warn"];

export interface LaunchSummary {
  readonly done: number;
  readonly total: number;
  /** ما يفعله الفريق الآن (فعل أو تحذير)، بالترتيب: التحذير أولًا ثم الأفعال. */
  readonly open: readonly LaunchEntry[];
  /** ما لا فعل له هنا: «لاحقًا» و«قرار المالك». */
  readonly waiting: readonly LaunchEntry[];
  readonly completed: readonly LaunchEntry[];
  /** اكتمل كل ما بيد الفريق: لا فعل ولا تحذير باقٍ (القائمة تصير شريطًا رفيعًا). */
  readonly settled: boolean;
}

/** ملخص البنود الظاهرة للموظف (يُرشَّح كل بند بصلاحية فعله قبل الملخص). */
export function launchSummary(entries: readonly LaunchEntry[]): LaunchSummary {
  const open = entries
    .filter((entry) => OPEN_STATES.includes(entry.state))
    .sort((a, b) => Number(b.state === "warn") - Number(a.state === "warn"));
  return {
    done: entries.filter((entry) => entry.state === "done").length,
    total: entries.length,
    open,
    waiting: entries.filter((entry) => entry.state === "later" || entry.state === "owner"),
    completed: entries.filter((entry) => entry.state === "done"),
    settled: open.length === 0,
  };
}
