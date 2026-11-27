import { CONTENT_LOCALES, type ContentLocale } from "./locale";
import { textKindOf, type TextKind } from "./limits";
import { isUnder, namespaceOf, placeholderNames, textAt, textLeaves } from "./paths";

/**
 * سجل نصوص المحتوى (ADMIN_A3_CONTENT §3.2): يمشي القاموس العربي ويقرر لكل ورقة هل تُعدَّل ومن يعدّلها،
 * أو لماذا تبقى قراءةً. القاعدة: أطول بادئة مطابقة في قائمة السماح تحكم، وما لا تطابقه بادئة ممنوع.
 * يُبنى مرة في العملية من القاموسين، فمفتاح جديد في القاموس يظهر في اللوحة بلا ترحيل.
 */
export type ContentPermission = "content.write" | "content.facts";

export type TextRule =
  | { readonly prefix: string; readonly permission: ContentPermission }
  | { readonly prefix: string; readonly locked: string };

/** سبب المنع لورقة لا تطابقها بادئة، ولورقة افتراضيها فارغ (إضافة نص حيث لا نص تحتاج كودًا). */
export const LOCK_NOT_LISTED = "notListed";
export const LOCK_EMPTY_DEFAULT = "emptyDefault";

export type LocalizedTexts = Readonly<Record<ContentLocale, string>>;

export interface TextEntry {
  readonly path: string;
  readonly namespace: string;
  readonly kind: TextKind;
  readonly permission: ContentPermission;
  readonly defaults: LocalizedTexts;
  readonly placeholders: Readonly<Record<ContentLocale, readonly string[]>>;
  /** بصمة الافتراضي لكل لغة: تجاوز حُفظ على بصمة أخرى ⇒ «تغيّر الافتراضي بعد تعديلك». */
  readonly defaultHash: LocalizedTexts;
}

export interface LockedText {
  readonly path: string;
  readonly namespace: string;
  readonly reason: string;
  readonly defaults: LocalizedTexts;
}

export interface TextRegistry {
  readonly editable: ReadonlyMap<string, TextEntry>;
  readonly locked: readonly LockedText[];
  /** المساحات بترتيب القاموس. */
  readonly namespaces: readonly string[];
}

export type HashText = (text: string) => string;

function ruleFor(path: string, rules: readonly TextRule[]): TextRule | undefined {
  return rules
    .filter((rule) => isUnder(path, rule.prefix))
    .reduce<
      TextRule | undefined
    >((best, rule) => (best === undefined || rule.prefix.length > best.prefix.length ? rule : best), undefined);
}

function lockReason(rule: TextRule | undefined, defaults: LocalizedTexts): string | null {
  if (rule === undefined) {
    return LOCK_NOT_LISTED;
  }
  if ("locked" in rule) {
    return rule.locked;
  }
  return CONTENT_LOCALES.some((locale) => defaults[locale] === "") ? LOCK_EMPTY_DEFAULT : null;
}

function entryOf(
  path: string,
  defaults: LocalizedTexts,
  permission: ContentPermission,
  hash: HashText,
): TextEntry {
  return {
    path,
    namespace: namespaceOf(path),
    kind: textKindOf(path, [defaults.ar, defaults.en]),
    permission,
    defaults,
    placeholders: { ar: placeholderNames(defaults.ar), en: placeholderNames(defaults.en) },
    defaultHash: { ar: hash(defaults.ar), en: hash(defaults.en) },
  };
}

/**
 * يبني السجل من القاموسين. ورقة بلا نظير نصي في الإنجليزي (مصفوفة أقصر) تبقى قراءةً: التجاوز لا يضيف
 * عنصرًا.
 */
export function buildTextRegistry(
  dictionaries: Readonly<Record<ContentLocale, unknown>>,
  rules: readonly TextRule[],
  hash: HashText,
): TextRegistry {
  const editable = new Map<string, TextEntry>();
  const locked: LockedText[] = [];
  const namespaces: string[] = [];
  for (const leaf of textLeaves(dictionaries.ar)) {
    const defaults = { ar: leaf.value, en: textAt(dictionaries.en, leaf.path) ?? "" };
    const rule = ruleFor(leaf.path, rules);
    const reason = lockReason(rule, defaults);
    const namespace = namespaceOf(leaf.path);
    if (!namespaces.includes(namespace)) {
      namespaces.push(namespace);
    }
    if (reason === null && rule !== undefined && "permission" in rule) {
      editable.set(leaf.path, entryOf(leaf.path, defaults, rule.permission, hash));
    } else {
      locked.push({ path: leaf.path, namespace, reason: reason ?? LOCK_NOT_LISTED, defaults });
    }
  }
  return { editable, locked, namespaces };
}
