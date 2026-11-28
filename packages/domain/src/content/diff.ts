import { CONTENT_LOCALES, type ContentLocale } from "./locale";
import type { TextRegistry } from "./registry";
import { buildSnapshot, type Snapshot, type TextOverrides } from "./snapshot";
import { EMPTY_SLIDER, type SliderState } from "./slider/types";
import { NO_SETTINGS, type SettingOverrides } from "./settings/state";

/**
 * بصمة المحتوى والفرق بين مجموعتي تجاوزات (ADMIN_A3_CONTENT §8.1). البصمة على الشكل القانوني (مرتب
 * بالمسار ثم اللغة)، فالترتيب الذي كُتبت به المسودة لا يغيّرها. دالة التجزئة تُحقن (المجال بلا منصة).
 */
export function contentDigest(
  texts: TextOverrides,
  sha256Hex: (text: string) => string,
  slider: SliderState = EMPTY_SLIDER,
  settings: SettingOverrides = NO_SETTINGS,
): string {
  return sha256Hex(JSON.stringify(buildSnapshot(texts, slider, settings)));
}

/** إعدادات لقطة ← صفوف مسودة (`setting:<معرّف>`) للاسترجاع والتجاهل. */
export function snapshotSettingEntries(snapshot: Snapshot) {
  return Object.entries(snapshot.settings ?? {}).map(([id, value]) => ({ id, value }));
}

/** لقطة الإصدار ← صفوف مسودة بالمفاتيح نفسها (الاسترجاع والتجاهل يعيدان المسودة إلى إصدار). */
export function snapshotEntries(snapshot: Snapshot) {
  return Object.entries(snapshot.texts).flatMap(([path, locales]) =>
    CONTENT_LOCALES.flatMap((locale) => {
      const override = locales[locale];
      return override === undefined ? [] : [{ path, locale, value: override }];
    }),
  );
}

export type ChangeKind = "added" | "changed" | "removed";

export interface ContentChange {
  readonly path: string;
  readonly namespace: string;
  readonly locale: ContentLocale;
  readonly kind: ChangeKind;
  /** القيمة قبل (المنشور أو الافتراضي). */
  readonly before: string;
  /** القيمة بعد (المسودة أو الافتراضي حين يُزال تجاوز). */
  readonly after: string;
}

function kindOf(before: string | undefined, after: string | undefined): ChangeKind {
  if (before === undefined) {
    return "added";
  }
  return after === undefined ? "removed" : "changed";
}

/** كل نص ولغة اختلفت قيمته المعروضة، بترتيب القاموس. تجاوز يساوي الافتراضي لا يُعدّ تغييرًا. */
export function diffContent(
  before: TextOverrides,
  after: TextOverrides,
  registry: TextRegistry,
): ContentChange[] {
  const changes: ContentChange[] = [];
  for (const entry of registry.editable.values()) {
    for (const locale of CONTENT_LOCALES) {
      const old = before.get(entry.path)?.[locale]?.value;
      const next = after.get(entry.path)?.[locale]?.value;
      const shownBefore = old ?? entry.defaults[locale];
      const shownAfter = next ?? entry.defaults[locale];
      if (shownBefore !== shownAfter) {
        changes.push({
          path: entry.path,
          namespace: entry.namespace,
          locale,
          kind: kindOf(old, next),
          before: shownBefore,
          after: shownAfter,
        });
      }
    }
  }
  return changes;
}
