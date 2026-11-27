import { slideJson } from "./serialize";
import type { Slide, SliderState } from "./types";

/**
 * الفرق بين شريطين (ADMIN_A3_SLIDER §7): شريحة أُضيفت أو أُزيلت أو تغيّرت (بأسماء حقولها المتغيرة) أو
 * تحرّك موضعها بين الشرائح الباقية، والإعدادات. المطابقة بالمعرّف الثابت للشريحة.
 */
export const SLIDE_DIFF_FIELDS = [
  "desktop",
  "mobile",
  "decorative",
  "alt",
  "texts",
  "link",
  "clickTarget",
  "active",
  "schedule",
] as const;
export type SlideDiffField = (typeof SLIDE_DIFF_FIELDS)[number];

export type SliderChange =
  | {
      readonly kind: "added" | "removed" | "moved";
      readonly slideId: string;
      /** الموضع بعد التغيير (أو قبله للمُزالة)، من الصفر. */
      readonly position: number;
      readonly slide: Slide;
    }
  | {
      readonly kind: "changed";
      readonly slideId: string;
      readonly position: number;
      readonly slide: Slide;
      readonly fields: readonly SlideDiffField[];
    }
  | { readonly kind: "settings"; readonly fields: readonly ("autoplay" | "intervalMs")[] };

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function changedFields(before: Slide, after: Slide): SlideDiffField[] {
  const a = slideJson(before);
  const b = slideJson(after);
  const pairs: readonly (readonly [SlideDiffField, unknown, unknown])[] = [
    ["desktop", a.desktop.id, b.desktop.id],
    ["mobile", a.mobile?.id ?? null, b.mobile?.id ?? null],
    ["decorative", a.decorative, b.decorative],
    ["alt", a.alt, b.alt],
    ["texts", a.texts, b.texts],
    ["link", a.link, b.link],
    ["clickTarget", a.clickTarget, b.clickTarget],
    ["active", a.active, b.active],
    ["schedule", [a.startsAt, a.endsAt], [b.startsAt, b.endsAt]],
  ];
  return pairs.filter(([, x, y]) => !same(x, y)).map(([field]) => field);
}

function settingsChange(before: SliderState, after: SliderState): SliderChange[] {
  const fields = (["autoplay", "intervalMs"] as const).filter(
    (field) => before.settings[field] !== after.settings[field],
  );
  return fields.length === 0 ? [] : [{ kind: "settings", fields }];
}

export function diffSlider(before: SliderState, after: SliderState): SliderChange[] {
  const beforeIds = before.slides.map((slide) => slide.id);
  const afterIds = after.slides.map((slide) => slide.id);
  const keptBefore = beforeIds.filter((id) => afterIds.includes(id));
  const keptAfter = afterIds.filter((id) => beforeIds.includes(id));
  const changes: SliderChange[] = [];
  after.slides.forEach((slide, position) => {
    const old = before.slides.find((item) => item.id === slide.id);
    if (old === undefined) {
      changes.push({ kind: "added", slideId: slide.id, position, slide });
      return;
    }
    const fields = changedFields(old, slide);
    if (fields.length > 0) {
      changes.push({ kind: "changed", slideId: slide.id, position, slide, fields });
    }
    if (keptBefore.indexOf(slide.id) !== keptAfter.indexOf(slide.id)) {
      changes.push({ kind: "moved", slideId: slide.id, position, slide });
    }
  });
  before.slides.forEach((slide, position) => {
    if (!afterIds.includes(slide.id)) {
      changes.push({ kind: "removed", slideId: slide.id, position, slide });
    }
  });
  return [...changes, ...settingsChange(before, after)];
}
