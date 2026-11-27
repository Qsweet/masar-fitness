/**
 * مسارات أوراق القاموس (ADMIN_A3_CONTENT §3.2): أسماء بنقاط والفهرس رقم (`hero.title`،
 * `about.paragraphs.0`). المسار يشير إلى ورقة نصية موجودة، ولا يصنع التجاوز مفتاحًا ولا عنصرًا.
 */
export const CONTENT_PATH_SHAPE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/;
/** أطول مسار في القاموس اليوم نحو 40 محرفًا؛ الحد يرفض الإدخال المصنوع قبل أي بحث. */
export const MAX_CONTENT_PATH_LENGTH = 120;

export interface TextLeaf {
  readonly path: string;
  readonly value: string;
}

/** كل ورقة نصية في الشجرة بمسارها، بترتيب القاموس. */
export function textLeaves(tree: unknown, prefix = ""): TextLeaf[] {
  if (typeof tree === "string") {
    return [{ path: prefix, value: tree }];
  }
  const entries: [string, unknown][] = Array.isArray(tree)
    ? tree.map((item: unknown, index) => [String(index), item])
    : typeof tree === "object" && tree !== null
      ? Object.entries(tree)
      : [];
  return entries.flatMap(([key, item]) =>
    textLeaves(item, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function childOf(node: unknown, segment: string): unknown {
  if (typeof node !== "object" || node === null || !Object.hasOwn(node, segment)) {
    return undefined;
  }
  return Object.entries(node).find(([key]) => key === segment)?.[1];
}

/** الورقة النصية في المسار، أو undefined إن لم يكن المسار ورقة نصية. */
export function textAt(tree: unknown, path: string): string | undefined {
  const node = path.split(".").reduce<unknown>(childOf, tree);
  return typeof node === "string" ? node : undefined;
}

export function namespaceOf(path: string): string {
  return path.split(".")[0] ?? path;
}

/** هل `path` هو `prefix` نفسه أو تحته (‎hero‎ يشمل ‎hero.title‎ لا ‎heroes‎)؟ */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`);
}

const PLACEHOLDER = /\{(\w+)\}/g;
const ANY_BRACE = /[{}]/;

/** أسماء العناصر النائبة في القالب بلا تكرار ومرتبة (`{amount}` ⇒ `amount`). */
export function placeholderNames(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? ""))].sort();
}

/** هل في النص قوس معقوف خارج عنصر نائب صحيح؟ (`{ x}` أو `}` وحده). */
export function hasStrayBrace(text: string): boolean {
  return ANY_BRACE.test(text.replace(PLACEHOLDER, ""));
}
