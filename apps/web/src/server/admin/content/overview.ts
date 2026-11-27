import "server-only";
import type { ReleaseHead } from "@masar/db";
import {
  CONTENT_LOCALES,
  contentDigest,
  diffContent,
  TEXT_ADVISORY,
  textLength,
  type ContentChange,
} from "@masar/domain";
import { sha256Hex, textRegistry } from "../../content/registry";
import { loadContentState } from "./state";

/**
 * حالة المسودة مقارنةً بآخر إصدار (ADMIN_A3_CONTENT §8.1): التغييرات بقديمها وجديدها، والبصمة التي
 * يختمها رمز النشر، وما يحتاج انتباهًا (تجاوز معطّل، أصل تغيّر، طول خارج ما تعرضه نتائج البحث).
 */
export interface DraftSummary {
  readonly changes: readonly ContentChange[];
  readonly digest: string;
  readonly head: ReleaseHead | null;
  readonly dirty: boolean;
  readonly dropped: readonly string[];
  readonly baseChanged: number;
  /** «المسار [اللغة]» لكل عنوان أو وصف خارج المدى المقروء. */
  readonly lengthWarnings: readonly string[];
}

function lengthWarnings(changes: readonly ContentChange[]): string[] {
  const registry = textRegistry();
  return changes.flatMap((change) => {
    const entry = registry.editable.get(change.path);
    const range = entry === undefined ? undefined : TEXT_ADVISORY[entry.kind];
    const length = textLength(change.after);
    return range === undefined || (length >= range.min && length <= range.max)
      ? []
      : [`${change.path} [${change.locale}]`];
  });
}

export async function draftSummary(clubId: string): Promise<DraftSummary> {
  const registry = textRegistry();
  const state = await loadContentState(clubId, registry);
  const changes = diffContent(state.published.texts, state.draft.texts, registry);
  const digest = contentDigest(state.draft.texts, sha256Hex);
  const baseChanged = [...state.draft.texts].reduce((count, [path, locales]) => {
    const entry = registry.editable.get(path);
    return (
      count +
      CONTENT_LOCALES.filter(
        (locale) =>
          entry !== undefined &&
          locales[locale] !== undefined &&
          locales[locale].baseHash !== entry.defaultHash[locale],
      ).length
    );
  }, 0);
  return {
    changes,
    digest,
    head: state.published.head,
    // التعريف نفسه في الاسترجاع والتجاهل (`isDraftDirty`): فرق في النص المعروض بالسجل الحالي
    dirty: changes.length > 0,
    dropped: state.draft.dropped,
    baseChanged,
    lengthWarnings: lengthWarnings(changes),
  };
}
