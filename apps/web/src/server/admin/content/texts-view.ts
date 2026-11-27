import {
  CONTENT_LOCALES,
  singleLine,
  type LocalizedTexts,
  type TextEntry,
  type TextRegistry,
} from "@masar/domain";
import { CONTENT_SEARCH_MAX_LENGTH, CONTENT_SEARCH_RESULTS } from "@/config/admin";

/**
 * عرض متصفح النصوص (ADMIN_A3_CONTENT §9): شجرة المساحات بعدّ ما يُعدَّل منها، والبحث في المسار والنص
 * باللغتين. منطق عرض بلا قراءة قاعدة: السجل وحده.
 */
export interface NamespaceSummary {
  readonly namespace: string;
  readonly editable: number;
  readonly total: number;
}

export function namespaceSummaries(registry: TextRegistry): NamespaceSummary[] {
  const all = [
    ...[...registry.editable.values()].map((entry) => ({ namespace: entry.namespace, ok: true })),
    ...registry.locked.map((item) => ({ namespace: item.namespace, ok: false })),
  ];
  return registry.namespaces.map((namespace) => {
    const mine = all.filter((item) => item.namespace === namespace);
    return {
      namespace,
      editable: mine.filter((item) => item.ok).length,
      total: mine.length,
    };
  });
}

export type TextRow =
  | { readonly path: string; readonly defaults: LocalizedTexts; readonly entry: TextEntry }
  | { readonly path: string; readonly defaults: LocalizedTexts; readonly reason: string };

/** كل النصوص بترتيب القاموس: المسموح ثم الممنوع في كل مساحة كما وردا. */
function allRows(registry: TextRegistry): TextRow[] {
  const editable = [...registry.editable.values()].map(
    (entry): TextRow => ({ path: entry.path, defaults: entry.defaults, entry }),
  );
  const locked = registry.locked.map(
    (item): TextRow => ({ path: item.path, defaults: item.defaults, reason: item.reason }),
  );
  const order = new Map(registry.namespaces.map((namespace, index) => [namespace, index]));
  const rank = (row: TextRow) => order.get(row.path.split(".")[0] ?? "") ?? 0;
  return [...editable, ...locked].sort((a, b) => rank(a) - rank(b));
}

/** للمقارنة: بلا تشكيل ولا تطويل، وبحروف صغيرة. */
function comparable(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ْـ]/gu, "")
    .toLowerCase();
}

/** عبارة البحث من الرابط: سطر واحد منظَّف، وما زاد طوله يُعامل غائبًا. */
export function parseTextSearch(raw: string | string[] | undefined): string | null {
  if (typeof raw !== "string" || raw.length > CONTENT_SEARCH_MAX_LENGTH) {
    return null;
  }
  const query = singleLine(raw);
  return query === "" ? null : query;
}

export interface TextSearch {
  readonly rows: readonly TextRow[];
  readonly total: number;
}

export function searchTexts(registry: TextRegistry, query: string): TextSearch {
  const needle = comparable(query);
  const matches = allRows(registry).filter(
    (row) =>
      comparable(row.path).includes(needle) ||
      CONTENT_LOCALES.some((locale) => comparable(row.defaults[locale]).includes(needle)),
  );
  return { rows: matches.slice(0, CONTENT_SEARCH_RESULTS), total: matches.length };
}

export interface NamespaceTexts {
  readonly editable: readonly TextEntry[];
  readonly locked: readonly {
    readonly path: string;
    readonly defaults: LocalizedTexts;
    readonly reason: string;
  }[];
}

/** نصوص مساحة واحدة، أو null لمساحة غير موجودة في القاموس. */
export function namespaceTexts(registry: TextRegistry, namespace: string): NamespaceTexts | null {
  if (!registry.namespaces.includes(namespace)) {
    return null;
  }
  return {
    editable: [...registry.editable.values()].filter((entry) => entry.namespace === namespace),
    locked: registry.locked.filter((item) => item.namespace === namespace),
  };
}
