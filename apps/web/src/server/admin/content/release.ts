import "server-only";
import type { DraftRow, ReleaseBuild } from "@masar/db";
import {
  buildSnapshot,
  CONTENT_LOCALES,
  contentDigest,
  diffContent,
  DomainError,
  draftOverrides,
  err,
  ok,
  parseSnapshot,
  validateTextOverride,
  type Result,
  type TextOverrides,
  type TextRegistry,
} from "@masar/domain";
import { sha256Hex } from "../../content/registry";

/**
 * بناء إصدار من المسودة تحت قفل النشر (ADMIN_A3_CONTENT §8.4): كل تجاوز يمر بالتحقق كاملًا (ومنه تدقيق
 * النصوص بقواعد الكود الحالي)، وأي مخالفة ترفض النشر كله. التجاوز المعطّل (لا يطابق السجل) لا يُنشر.
 */
export function draftDigest(rows: readonly DraftRow[], registry: TextRegistry): string {
  return contentDigest(draftOverrides(rows, registry).texts, sha256Hex);
}

export function publishedTexts(snapshot: unknown, registry: TextRegistry): TextOverrides {
  return parseSnapshot(snapshot, registry)?.texts ?? new Map();
}

function firstInvalid(texts: TextOverrides, registry: TextRegistry): string | null {
  for (const [path, locales] of texts) {
    const entry = registry.editable.get(path);
    for (const locale of CONTENT_LOCALES) {
      const override = locales[locale];
      if (entry === undefined || override === undefined) {
        continue;
      }
      const checked = validateTextOverride(entry, override.value, locale);
      if (!checked.ok || checked.value.kind === "default") {
        return path;
      }
    }
  }
  return null;
}

function releaseFrom(
  texts: TextOverrides,
  previous: unknown,
  registry: TextRegistry,
): Result<ReleaseBuild, DomainError> {
  const invalid = firstInvalid(texts, registry);
  if (invalid !== null) {
    return err(new DomainError("validation", "content.draft_invalid", { field: invalid }));
  }
  return ok({
    snapshot: buildSnapshot(texts),
    digest: contentDigest(texts, sha256Hex),
    changedCount: diffContent(publishedTexts(previous, registry), texts, registry).length,
  });
}

export function buildRelease(
  rows: readonly DraftRow[],
  previous: unknown,
  registry: TextRegistry,
): Result<ReleaseBuild, DomainError> {
  return releaseFrom(draftOverrides(rows, registry).texts, previous, registry);
}

/**
 * لقطة إصدار قديم يُسترجع: تُقرأ بالسجل الحالي وتمر بالتحقق نفسه الذي يمر به النشر (قواعد التدقيق
 * الحالية)، فلا يعود إلى الموقع نص يرفضه الحفظ اليوم.
 */
export function rebuildRelease(
  target: unknown,
  previous: unknown,
  registry: TextRegistry,
): Result<ReleaseBuild, DomainError> {
  return releaseFrom(publishedTexts(target, registry), previous, registry);
}

/**
 * تعريف واحد لـ«المسودة متغيرة» في الحالة والاسترجاع والتجاهل: فرق في النص المعروض بين المنشور والمسودة،
 * كلاهما مقروء بالسجل الحالي. البصمة المحفوظة مع الإصدار حُسبت بسجل وقت النشر، فلا تُقارن بها مسودة
 * اليوم بعد أن يمنع كود جديد مفتاحًا أو يحذفه.
 */
export function isDraftDirty(
  rows: readonly DraftRow[],
  published: unknown,
  registry: TextRegistry,
): boolean {
  const draft = draftOverrides(rows, registry).texts;
  return diffContent(publishedTexts(published, registry), draft, registry).length > 0;
}
