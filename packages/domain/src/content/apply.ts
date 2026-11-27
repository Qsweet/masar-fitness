import type { ContentLocale } from "./locale";
import type { TextOverrides } from "./snapshot";

/**
 * يطبّق التجاوزات على قاموس لغة واحدة (ADMIN_A3_CONTENT §4.1): ينسخ الفروع على مسار كل تجاوز فقط،
 * والباقي يبقى المرجع نفسه (لا نسخ عميق). مسار لا يقع على ورقة نصية قائمة يُهمل: التجاوز لا يضيف
 * مفتاحًا ولا عنصرًا ولا يغيّر نوعًا.
 */
function replaceAt(node: unknown, segments: readonly string[], value: string): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) {
    return typeof node === "string" ? value : node;
  }
  if (typeof node !== "object" || node === null || !Object.hasOwn(node, head)) {
    return node;
  }
  if (Array.isArray(node)) {
    const index = Number(head);
    return node.map((item: unknown, position) =>
      position === index ? replaceAt(item, rest, value) : item,
    );
  }
  const entries = Object.entries(node).map(([key, child]): [string, unknown] => [
    key,
    key === head ? replaceAt(child, rest, value) : child,
  ]);
  return Object.fromEntries(entries);
}

export function applyTextOverrides<T>(tree: T, overrides: TextOverrides, locale: ContentLocale): T {
  let result: unknown = tree;
  for (const [path, locales] of overrides) {
    const override = locales[locale];
    if (override !== undefined) {
      result = replaceAt(result, path.split("."), override.value);
    }
  }
  // replaceAt يحفظ الشكل: كل فرع يُنسخ بمفاتيحه نفسها، والورقة النصية وحدها تتغير بنص
  return result as T;
}
