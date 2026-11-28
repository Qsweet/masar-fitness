import "server-only";
import type { DraftRow, ReleaseBuild } from "@masar/db";
import {
  buildSnapshot,
  CONTENT_LOCALES,
  contentDigest,
  diffContent,
  diffSettings,
  diffSlider,
  DomainError,
  draftOverrides,
  draftSettings,
  err,
  ok,
  parseSnapshot,
  SETTINGS,
  snapshotSettings,
  snapshotSlider,
  unpublishableSlides,
  validateTextOverride,
  type Result,
  type SettingOverrides,
  type SliderState,
  type TextOverrides,
  type TextRegistry,
} from "@masar/domain";
import { SITE_SETTING_DEFAULTS } from "@/config/site-settings";
import { sha256Hex } from "../../content/registry";

/**
 * بناء إصدار من المسودة تحت قفل النشر (ADMIN_A3_CONTENT §8.4): كل تجاوز يمر بالتحقق كاملًا (ومنه تدقيق
 * النصوص بقواعد الكود الحالي)، وأي مخالفة ترفض النشر كله. التجاوز المعطّل (لا يطابق السجل) لا يُنشر.
 * الشريط (ADMIN_A3_SLIDER §7) والإعدادات المنظَّمة (§5) في اللقطة نفسها: تدخل البصمة والفرق وعدّ
 * التغييرات، وكل شريحة وكل إعداد يمر بتحقق الحفظ نفسه وبقائمة الروابط الداخلية الحالية.
 */
export interface ReleaseContext {
  readonly registry: TextRegistry;
  /** المسارات الداخلية المعروفة الآن (`knownSlidePaths`). */
  readonly knownPaths: ReadonlySet<string>;
}

/** محتوى كامل: النصوص والشريط والإعدادات. */
export interface ContentSet {
  readonly texts: TextOverrides;
  readonly slider: SliderState;
  readonly settings: SettingOverrides;
}

export function draftContent(
  rows: readonly DraftRow[],
  registry: TextRegistry,
  slider: SliderState,
): ContentSet {
  return {
    texts: draftOverrides(rows, registry).texts,
    slider,
    settings: draftSettings(rows).settings,
  };
}

export function publishedContent(snapshot: unknown, registry: TextRegistry): ContentSet {
  return {
    texts: parseSnapshot(snapshot, registry)?.texts ?? new Map(),
    slider: snapshotSlider(snapshot).slider,
    settings: snapshotSettings(snapshot).settings,
  };
}

export function digestOf(content: ContentSet): string {
  return contentDigest(content.texts, sha256Hex, content.slider, content.settings);
}

export function draftDigest(
  rows: readonly DraftRow[],
  registry: TextRegistry,
  slider: SliderState,
): string {
  return digestOf(draftContent(rows, registry, slider));
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

/** أول إعداد لا يمر بتحقق الحفظ اليوم (قاعدة تدقيق جديدة، رابط داخلي لم يعد معروفًا)، أو null. */
function invalidSetting(settings: SettingOverrides, context: ReleaseContext): string | null {
  for (const [id, value] of settings) {
    if (!SETTINGS[id].validate(value, { knownPaths: context.knownPaths }).ok) {
      return id;
    }
  }
  return null;
}

/** عدد التغييرات المعروضة بين محتويين: النصوص والشريط والإعدادات معًا. */
export function changeCount(before: ContentSet, after: ContentSet, registry: TextRegistry): number {
  return (
    diffContent(before.texts, after.texts, registry).length +
    diffSlider(before.slider, after.slider).length +
    diffSettings(before.settings, after.settings, SITE_SETTING_DEFAULTS).length
  );
}

function releaseFrom(
  draft: ContentSet,
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
  const setting = invalidSetting(draft.settings, context);
  if (setting !== null) {
    return err(new DomainError("validation", "content.setting_invalid", { field: setting }));
  }
  return ok({
    snapshot: buildSnapshot(draft.texts, draft.slider, draft.settings),
    digest: digestOf(draft),
    changedCount: changeCount(publishedContent(previous, registry), draft, registry),
    slider: draft.slider,
  });
}

export function buildRelease(
  rows: readonly DraftRow[],
  previous: unknown,
  slider: SliderState,
  context: ReleaseContext,
): Result<ReleaseBuild, DomainError> {
  return releaseFrom(draftContent(rows, context.registry, slider), previous, context);
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
  return releaseFrom(publishedContent(target, context.registry), previous, context);
}

/**
 * تعريف واحد لـ«المسودة متغيرة» في الحالة والاسترجاع والتجاهل: فرق في المعروض بين المنشور والمسودة
 * (نصًّا أو شريحة أو إعدادًا)، كلاهما مقروء بالسجل الحالي. البصمة المحفوظة مع الإصدار حُسبت بسجل وقت
 * النشر، فلا تُقارن بها مسودة اليوم بعد أن يمنع كود جديد مفتاحًا أو يحذفه.
 */
export function isDraftDirty(
  rows: readonly DraftRow[],
  published: unknown,
  slider: SliderState,
  registry: TextRegistry,
): boolean {
  const before = publishedContent(published, registry);
  return changeCount(before, draftContent(rows, registry, slider), registry) > 0;
}
