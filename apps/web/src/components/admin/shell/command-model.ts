import { hasPermission, type Permission, type StaffRole } from "@masar/domain";
import { ADMIN_ROUTES, contentPreviewHref, PREVIEW_DRAFT } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import type { AdminIconName } from "../admin-icon";
import { navGroupsFor, type NavKey } from "./nav-model";

/**
 * مدخلات لوحة الأوامر وصفحة البحث (ADMIN_REDESIGN §4.3، R1: الصفحات والإجراءات). تُحسب على الخادم من
 * صلاحيات الموظف، فلا يصل المتصفحَ ما لا يملكه؛ والمتصفح يرشّح القائمة المرسلة فقط. الإجراء رابط إلى
 * الصفحة القائمة التي تنفّذه بحارسها وتأكيدها: اللوحة لا تكتب شيئًا بنفسها.
 */
export type CommandKind = "page" | "action";
export type ActionKey = keyof AdminDictionary["shell"]["actions"];

export interface CommandEntry {
  readonly id: string;
  readonly kind: CommandKind;
  readonly label: string;
  /** سطر شارح: مجموعة الصفحة، أو ما يفعله الإجراء. */
  readonly hint: string;
  readonly href: string;
  readonly icon: AdminIconName;
  /** كلمات بحث إضافية لا تُعرض. */
  readonly keywords: string;
  /** وجهة ليست صفحة (مسار خادم يضع كوكي ثم يحوّل، كالمعاينة): تُفتح بتحميل كامل. */
  readonly fullLoad: boolean;
}

interface ActionSpec {
  readonly key: ActionKey;
  readonly href: string;
  readonly icon: AdminIconName;
  readonly permission: Permission;
}

/** بترتيب الإجراءات السريعة في «نظرة عامة» أولًا (§5.1)، ثم بقية الإجراءات. */
export const ACTIONS: readonly ActionSpec[] = [
  {
    key: "newSlide",
    href: ADMIN_ROUTES.contentSliderNew,
    icon: "slider",
    permission: "content.write",
  },
  { key: "newPlan", href: ADMIN_ROUTES.plansNew, icon: "plans", permission: "catalog.write" },
  {
    key: "newPromotion",
    href: ADMIN_ROUTES.promotionsNew,
    icon: "promotions",
    permission: "promotions.write",
  },
  { key: "findOrder", href: ADMIN_ROUTES.orders, icon: "search", permission: "orders.read" },
  { key: "newStaff", href: ADMIN_ROUTES.staffNew, icon: "staff", permission: "staff.manage" },
  {
    key: "awaitingOrders",
    href: `${ADMIN_ROUTES.orders}?tab=awaiting`,
    icon: "orders",
    permission: "orders.read",
  },
  {
    key: "previewDraft",
    href: contentPreviewHref(PREVIEW_DRAFT),
    icon: "eye",
    permission: "content.read",
  },
  {
    key: "reviewPublish",
    href: ADMIN_ROUTES.contentPublish,
    icon: "publish",
    permission: "content.publish",
  },
];

/** الإجراءات السريعة في «نظرة عامة»: خمسة، كلٌّ بصلاحيته. */
export const QUICK_ACTIONS: readonly ActionKey[] = [
  "newSlide",
  "newPlan",
  "newPromotion",
  "findOrder",
  "newStaff",
];

export function actionEntriesFor(
  role: StaffRole,
  dictionary: AdminDictionary,
  only?: readonly ActionKey[],
): CommandEntry[] {
  const { actions, keywords } = dictionary.shell;
  return ACTIONS.filter((action) => only === undefined || only.includes(action.key))
    .filter((action) => hasPermission(role, action.permission))
    .map(({ key, href, icon }) => ({
      id: `action:${key}`,
      kind: "action",
      label: actions[key].label,
      hint: actions[key].hint,
      href,
      icon,
      keywords: keywords[key],
      fullLoad: href.startsWith(ADMIN_ROUTES.contentPreview),
    }));
}

export function commandEntriesFor(role: StaffRole, dictionary: AdminDictionary): CommandEntry[] {
  const keywords: Readonly<Record<NavKey, string>> = dictionary.shell.keywords;
  const pages = navGroupsFor(role, dictionary).flatMap((group) =>
    group.items.map(
      (item): CommandEntry => ({
        id: `page:${item.key}`,
        kind: "page",
        label: item.label,
        hint: group.label,
        href: item.href,
        icon: item.icon,
        keywords: keywords[item.key],
        fullLoad: false,
      }),
    ),
  );
  return [...pages, ...actionEntriesFor(role, dictionary)];
}

/** حركات التشكيل والتطويل، وصور الألف والياء والتاء المربوطة: تُوحَّد قبل المقارنة. */
const DIACRITICS = /[ً-ْٰـ]/g;
const FOLDS: readonly (readonly [RegExp, string])[] = [
  [/[إأآٱ]/g, "ا"],
  [/ى/g, "ي"],
  [/ة/g, "ه"],
];

export function normalizeQuery(text: string): string {
  let result = text.toLowerCase().replace(DIACRITICS, "");
  for (const [pattern, replacement] of FOLDS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

export type CommandScope = "all" | CommandKind;

/** ترتيب المطابقة: بداية الاسم، ثم داخل الاسم، ثم الشرح أو الكلمات الإضافية. */
function rank(entry: CommandEntry, words: readonly string[]): number | null {
  const label = normalizeQuery(entry.label);
  const rest = normalizeQuery(`${entry.hint} ${entry.keywords}`);
  if (!words.every((word) => label.includes(word) || rest.includes(word))) {
    return null;
  }
  const first = words[0] ?? "";
  if (label.startsWith(first)) {
    return 0;
  }
  return label.includes(first) ? 1 : 2;
}

/**
 * المدخلات المطابقة لعبارة البحث في النطاق: كل كلمة في الاسم أو الشرح أو الكلمات الإضافية، بالعربية
 * والإنجليزية. عبارة فارغة تعيد النطاق كله بترتيبه.
 */
export function filterCommands(
  entries: readonly CommandEntry[],
  query: string,
  scope: CommandScope = "all",
): CommandEntry[] {
  const inScope = entries.filter((entry) => scope === "all" || entry.kind === scope);
  const words = normalizeQuery(query).split(" ").filter(Boolean);
  if (words.length === 0) {
    return inScope;
  }
  return inScope
    .map((entry, index) => ({ entry, index, rank: rank(entry, words) }))
    .filter((item): item is typeof item & { rank: number } => item.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.entry);
}

export type PaletteGroupKind = "recent" | CommandKind;

export interface PaletteGroup {
  readonly kind: PaletteGroupKind;
  readonly entries: readonly CommandEntry[];
}

/**
 * مجموعات لوحة الأوامر: حين البحث فارغ في نطاق «الكل» تأتي «الأخيرة» أولًا (روابط صفحات فُتحت، من
 * تخزين المتصفح، ولا تُكرَّر تحتها)، ثم الصفحات، ثم الإجراءات. المجموعة الفارغة لا تظهر.
 */
export function paletteGroups(
  entries: readonly CommandEntry[],
  query: string,
  scope: CommandScope,
  recent: readonly string[],
): PaletteGroup[] {
  const results = filterCommands(entries, query, scope);
  const showRecent = normalizeQuery(query) === "" && scope === "all";
  const recentEntries = showRecent
    ? recent.flatMap((href) => results.filter((e) => e.kind === "page" && e.href === href))
    : [];
  const rest = results.filter((entry) => !recentEntries.includes(entry));
  const groups: PaletteGroup[] = [
    { kind: "recent", entries: recentEntries },
    { kind: "page", entries: rest.filter((entry) => entry.kind === "page") },
    { kind: "action", entries: rest.filter((entry) => entry.kind === "action") },
  ];
  return groups.filter((group) => group.entries.length > 0);
}

/** أقصى عدد للصفحات «الأخيرة» المحفوظة في المتصفح. */
export const RECENT_LIMIT = 5;

/** يضيف الرابط إلى رأس «الأخيرة» بلا تكرار، بحدها. */
export function rememberRecent(recent: readonly string[], href: string): string[] {
  return [href, ...recent.filter((item) => item !== href)].slice(0, RECENT_LIMIT);
}
