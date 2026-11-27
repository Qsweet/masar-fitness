import "server-only";
import type { DraftRow, ReleaseBuild } from "@masar/db";
import {
  buildSnapshot,
  CONTENT_LOCALES,
  contentDigest,
  diffContent,
  diffSlider,
  DomainError,
  draftOverrides,
  err,
  ok,
  parseSnapshot,
  snapshotSlider,
  unpublishableSlides,
  validateTextOverride,
  type Result,
  type SliderState,
  type TextOverrides,
  type TextRegistry,
} from "@masar/domain";
import { sha256Hex } from "../../content/registry";

/**
 * بناء إصدار من المسودة تحت قفل النشر (ADMIN_A3_CONTENT §8.4): كل تجاوز يمر بالتحقق كاملًا (ومنه تدقيق
 * النصوص بقواعد الكود الحالي)، وأي مخالفة ترفض النشر كله. التجاوز المعطّل (لا يطابق السجل) لا يُنشر.
 * الشريط (ADMIN_A3_SLIDER §7) في اللقطة نفسها: يدخل البصمة والفرق وعدّ التغييرات، وكل شريحة تمر بقراءة
 * اللقطة وبقائمة الروابط الداخلية الحالية.
 */
export interface ReleaseContext {
  readonly registry: TextRegistry;
  /** المسارات الداخلية المعروفة الآن (`knownSlidePaths`). */
  readonly knownPaths: ReadonlySet<string>;
}

export function draftDigest(
  rows: readonly DraftRow[],
  registry: TextRegistry,
  slider: SliderState,
): string {
  return contentDigest(draftOverrides(rows, registry).texts, sha256Hex, slider);
}

export function publishedSlider(snapshot: unknown): SliderState {
  return snapshotSlider(snapshot).slider;
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

/** عدد التغييرات المعروضة بين محتويين: النصوص والشريط معًا. */
export function changeCount(
  before: { readonly texts: TextOverrides; readonly slider: SliderState },
  after: { readonly texts: TextOverrides; readonly slider: SliderState },
  registry: TextRegistry,
): number {
  return (
    diffContent(before.texts, after.texts, registry).length +
    diffSlider(before.slider, after.slider).length
  );
}

function releaseFrom(
  draft: { readonly texts: TextOverrides; readonly slider: SliderState },
  previous: unknown,
  context: ReleaseContext,
): Result<ReleaseBuild, DomainError> {
  const { registry } = context;
  const invalid = firstInvalid(draft.texts, registry);
  if (invalid !== null) {
    return err(new DomainError("validation", "content.draft_invalid", { field: invalid }));
  }
  if (unpublishableSlides(draft.slider, context.knownPaths).length > 0) {
    return err(new DomainError("validation", "content.slider_invalid"));
  }
  const before = { texts: publishedTexts(previous, registry), slider: publishedSlider(previous) };
  return ok({
    snapshot: buildSnapshot(draft.texts, draft.slider),
    digest: contentDigest(draft.texts, sha256Hex, draft.slider),
    changedCount: changeCount(before, draft, registry),
    slider: draft.slider,
  });
}

export function buildRelease(
  rows: readonly DraftRow[],
  previous: unknown,
  slider: SliderState,
  context: ReleaseContext,
): Result<ReleaseBuild, DomainError> {
  const texts = draftOverrides(rows, context.registry).texts;
  return releaseFrom({ texts, slider }, previous, context);
}

/**
 * لقطة إصدار قديم يُسترجع: تُقرأ بالسجل الحالي وتمر بالتحقق نفسه الذي يمر به النشر (قواعد التدقيق
 * الحالية)، فلا يعود إلى الموقع نص يرفضه الحفظ اليوم.
 */
export function rebuildRelease(
  target: unknown,
  previous: unknown,
  context: ReleaseContext,
): Result<ReleaseBuild, DomainError> {
  const draft = {
    texts: publishedTexts(target, context.registry),
    slider: publishedSlider(target),
  };
  return releaseFrom(draft, previous, context);
}

/**
 * تعريف واحد لـ«المسودة متغيرة» في الحالة والاسترجاع والتجاهل: فرق في النص المعروض بين المنشور والمسودة،
 * كلاهما مقروء بالسجل الحالي. البصمة المحفوظة مع الإصدار حُسبت بسجل وقت النشر، فلا تُقارن بها مسودة
 * اليوم بعد أن يمنع كود جديد مفتاحًا أو يحذفه.
 */
export function isDraftDirty(
  rows: readonly DraftRow[],
  published: unknown,
  slider: SliderState,
  registry: TextRegistry,
): boolean {
  const draft = { texts: draftOverrides(rows, registry).texts, slider };
  const before = { texts: publishedTexts(published, registry), slider: publishedSlider(published) };
  return changeCount(before, draft, registry) > 0;
}
