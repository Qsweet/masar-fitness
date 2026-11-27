import type { NavKey } from "./nav-model";

/**
 * اختصارات لوحة المفاتيح (ADMIN_REDESIGN §7). المطابقة بـ`event.code` (موضع الزر) لا `event.key`، فتعمل
 * مع لوحة المفاتيح العربية كما الإنجليزية. داخل الحقول لا يعمل إلا ⌘K/Ctrl K (وEsc من المتصفح)، وحين
 * يطفئها الموظف (WCAG 2.1.4) يبقى ⌘K وحده. منطق صرف يُختبر بلا متصفح.
 */
export type ShortcutAction =
  | { readonly kind: "palette" }
  | { readonly kind: "help" }
  | { readonly kind: "search" }
  | { readonly kind: "sidebar" }
  | { readonly kind: "chord" }
  | { readonly kind: "go"; readonly target: NavKey };

export interface KeyInput {
  readonly code: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  /** التركيز في حقل كتابة (input نصي، textarea، select، contenteditable). */
  readonly inField: boolean;
  /** حوار مفتوح (لوحة الأوامر، الاختصارات، الدرج، تأكيد): لا اختصار بحرف تحته. */
  readonly dialogOpen: boolean;
}

export interface ShortcutState {
  readonly enabled: boolean;
  /** ضُغط G للتو، والحرف التالي يختار الوجهة. */
  readonly chordPending: boolean;
}

/**
 * ضغطة جزء من تركيب بمحرر الإدخال: `isComposing`، أو `key` «Process» (المقابل الحديث لـ`keyCode` 229
 * المهجور، يرسله Chrome وSafari لأول ضغطة قبل أن يبدأ التركيب).
 */
export function isComposingKey(event: { readonly isComposing: boolean; readonly key: string }) {
  return event.isComposing || event.key === "Process";
}

/** `G` ثم حرف: الوجهة. */
export const CHORDS: Readonly<Record<string, NavKey>> = {
  KeyH: "overview",
  KeyO: "orders",
  KeyC: "customers",
  KeyT: "contentTexts",
  KeyS: "contentSlider",
};

const KEY_PREFIX = "Key";

/** «G O» لكل صفحة وجهة، بمعرّف مدخلها في لوحة الأوامر (`page:orders`): ما يُعرض بجانبها. */
export function chordLabels(
  targets: Readonly<Partial<Record<NavKey, string>>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(CHORDS).flatMap(([code, target]) => {
      const href = targets[target];
      return href === undefined ? [] : [[`page:${target}`, `G ${code.slice(KEY_PREFIX.length)}`]];
    }),
  );
}

/** وجهات `G` ثم حرف المتاحة: من الأقسام التي يراها الموظف فقط. */
export function chordTargets(
  sections: readonly { readonly key: NavKey; readonly href: string }[],
): Partial<Record<NavKey, string>> {
  const wanted = new Set<NavKey>(Object.values(CHORDS));
  return Object.fromEntries(
    sections.filter((section) => wanted.has(section.key)).map((s) => [s.key, s.href]),
  );
}

/** مهلة الحرف الثاني بعد G. */
export const CHORD_TIMEOUT_MS = 1200;

function isPalette(input: KeyInput): boolean {
  return input.code === "KeyK" && (input.metaKey || input.ctrlKey) && !input.altKey;
}

function single(input: KeyInput): ShortcutAction | null {
  switch (input.code) {
    case "KeyG":
      return input.shiftKey ? null : { kind: "chord" };
    case "Slash":
      return input.shiftKey ? { kind: "help" } : { kind: "search" };
    case "BracketLeft":
      return input.shiftKey ? null : { kind: "sidebar" };
    default:
      return null;
  }
}

/** اختصار بحرف: يعمل مفعَّلًا، خارج الحقول، وبلا مفاتيح تعديل (عدا Shift). */
function letterAllowed(input: KeyInput, state: ShortcutState): boolean {
  const modified = input.metaKey || input.ctrlKey || input.altKey;
  return state.enabled && !input.inField && !input.dialogOpen && !modified;
}

export function shortcutFor(input: KeyInput, state: ShortcutState): ShortcutAction | null {
  if (isPalette(input)) {
    return { kind: "palette" };
  }
  if (!letterAllowed(input, state)) {
    return null;
  }
  const target = Object.hasOwn(CHORDS, input.code) ? CHORDS[input.code] : undefined;
  if (state.chordPending && target !== undefined && !input.shiftKey) {
    return { kind: "go", target };
  }
  return single(input);
}

/** أنواع ‎<input>‎ التي ليست كتابة: الحرف فيها لا يُكتب، فالاختصار يعمل. */
const NON_TEXT_INPUTS = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "range",
  "color",
  "image",
  "hidden",
]);

/** هل العنصر حقل كتابة؟ حينها لا يعمل اختصار بحرف. خانة الاختيار والزر ليسا حقل كتابة. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(target.type);
  }
  return target.isContentEditable || ["TEXTAREA", "SELECT"].includes(target.tagName);
}

export type ShortcutKey = keyof typeof SHORTCUT_LIST_KEYS;

/** ما يعرضه حوار `?`: الأزرار بالترتيب، والاسم من القاموس بالمفتاح نفسه. */
export const SHORTCUT_LIST_KEYS = {
  palette: ["⌘", "K"],
  search: ["/"],
  help: ["?"],
  sidebar: ["["],
  escape: ["Esc"],
  overview: ["G", "H"],
  orders: ["G", "O"],
  customers: ["G", "C"],
  contentTexts: ["G", "T"],
  contentSlider: ["G", "S"],
} as const satisfies Record<string, readonly string[]>;
