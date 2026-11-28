import { isContentLocale, type ContentLocale } from "./locale";
import type { TextRegistry } from "./registry";
import {
  parseSnapshot,
  SNAPSHOT_VERSION,
  type LocaleOverrides,
  type ParsedSnapshot,
  type TextOverride,
} from "./snapshot";

/**
 * صفوف مسودة المحتوى (ADMIN_A3_CONTENT §8.2): مفتاح `text:<مسار>` ولغة، والقيمة تجاوز أو null
 * («عودة إلى الافتراضي»). المسودة كلها مجموعة التجاوزات المرغوبة، لا فرق عن المنشور.
 */
export const TEXT_KEY_PREFIX = "text:";

export interface DraftEntry {
  readonly key: string;
  readonly locale: string;
  readonly value: TextOverride | null;
  /** القيمة كما في القاعدة: صف إعداد منظَّم (`setting:<معرّف>`) يحمل كائنه هنا. */
  readonly raw?: unknown;
}

export function textKey(path: string): string {
  return `${TEXT_KEY_PREFIX}${path}`;
}

export function pathOfKey(key: string): string | null {
  return key.startsWith(TEXT_KEY_PREFIX) ? key.slice(TEXT_KEY_PREFIX.length) : null;
}

/**
 * تجاوزات المسودة الفعلية بتحقق اللقطة نفسه: ما لا يطابق السجل الحالي «معطّل» (`dropped`) لا يُنشر ولا
 * يُعاين، ويُعرض في اللوحة ليُعاد تحريره.
 */
export function draftOverrides(
  entries: readonly DraftEntry[],
  registry: TextRegistry,
): ParsedSnapshot {
  const texts: Record<string, Partial<Record<ContentLocale, TextOverride>>> = {};
  const dropped: string[] = [];
  for (const entry of entries) {
    const path = pathOfKey(entry.key);
    if (entry.value === null) {
      continue;
    }
    if (path === null || !isContentLocale(entry.locale)) {
      dropped.push(`${entry.key} [${entry.locale}]`);
      continue;
    }
    texts[path] = { ...texts[path], [entry.locale]: entry.value };
  }
  const parsed = parseSnapshot({ v: SNAPSHOT_VERSION, texts }, registry) ?? {
    texts: new Map<string, LocaleOverrides>(),
    dropped: [],
  };
  return { texts: parsed.texts, dropped: [...dropped, ...parsed.dropped] };
}
