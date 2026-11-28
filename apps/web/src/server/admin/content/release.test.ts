import type { DraftRow } from "@masar/db";
import {
  buildSnapshot,
  DEFAULT_SLIDER_SETTINGS,
  EMPTY_SLIDER,
  type Slide,
  type SliderState,
} from "@masar/domain";
import { describe, expect, it } from "vitest";
import { textRegistry } from "../../content/registry";
import { buildRelease, isDraftDirty, rebuildRelease } from "./release";

/**
 * مراجعة A3 (القرار 73): التجاوز المساوي للافتراضي لا يمنع النشر، والمسودة لا تصير «متغيرة» لأن الكود
 * منع مفتاحًا أو حذفه بعد النشر، والاسترجاع يمر بتحقق النشر نفسه.
 */
const registry = textRegistry();
const context = { registry, knownPaths: new Set(["/", "/memberships"]) };
const HASH = "a".repeat(64);
const at = new Date("2026-11-28T10:00:00Z");

function row(path: string, value: string, locale = "ar"): DraftRow {
  return {
    key: `text:${path}`,
    locale,
    value: { value, baseHash: HASH },
    raw: { value, baseHash: HASH },
    lockToken: "1",
    updatedBy: "s",
    updatedAt: at,
  };
}

function snapshot(entries: Record<string, string>) {
  return buildSnapshot(
    new Map(
      Object.entries(entries).map(([path, value]) => [path, { ar: { value, baseHash: HASH } }]),
    ),
  );
}

describe("التجاوز المساوي للافتراضي", () => {
  it("لا يمنع النشر ولا يُعدّ تغييرًا", () => {
    const rows = [row("hero.title", "أقوى نسخة منك"), row("hero.slogan", "تبدأ معنا.")];
    const built = buildRelease(rows, null, EMPTY_SLIDER, context);
    expect(built.ok).toBe(true);
    expect(built.ok ? built.value.changedCount : -1).toBe(1);
    expect(built.ok ? Object.keys(built.value.snapshot.texts) : []).toEqual(["hero.slogan"]);
  });
});

describe("المسودة متغيرة: فرق في النص المعروض بالسجل الحالي", () => {
  it("مفتاح مُنع أو حُذف بعد النشر لا يجعل المسودة متغيرة", () => {
    const published = snapshot({
      "hero.slogan": "تبدأ معنا.",
      "hero.pause": "قف",
      "hero.gone": "قديم",
    });
    const rows = [
      row("hero.slogan", "تبدأ معنا."),
      row("hero.pause", "قف"),
      row("hero.gone", "قديم"),
    ];
    expect(isDraftDirty(rows, published, EMPTY_SLIDER, registry)).toBe(false);
    expect(isDraftDirty([row("hero.slogan", "غيرها.")], published, EMPTY_SLIDER, registry)).toBe(
      true,
    );
    expect(isDraftDirty([], null, EMPTY_SLIDER, registry)).toBe(false);
  });
});

describe("الاسترجاع بتحقق النشر", () => {
  it("لقطة قديمة تخالف التدقيق الحالي مرفوضة، والسليمة تُبنى بالسجل الحالي", () => {
    const refused = rebuildRelease(snapshot({ "hero.title": "أقوى  نسخة" }), null, context);
    expect(refused).toMatchObject({ ok: false, error: { reason: "content.draft_invalid" } });
    const rebuilt = rebuildRelease(
      snapshot({ "hero.title": "عنوان", "hero.pause": "قف" }),
      snapshot({ "hero.title": "عنوان" }),
      context,
    );
    expect(rebuilt).toMatchObject({ ok: true, value: { changedCount: 0 } });
  });
});

const SLIDE: Slide = {
  id: "33333333-3333-4333-8333-333333333333",
  desktop: {
    id: "11111111-1111-4111-8111-111111111111",
    hash: HASH,
    width: 2560,
    height: 1440,
    widths: [640, 1280, 2560],
    blur: "data:image/webp;base64,AAAA",
    color: "#202020",
  },
  mobile: null,
  decorative: false,
  alt: { ar: "الصالة", en: "The hall" },
  texts: {
    ar: { eyebrow: "", title: "عرض", subtitle: "", cta: "الاشتراكات" },
    en: { eyebrow: "", title: "Offer", subtitle: "", cta: "Memberships" },
  },
  link: { kind: "internal", path: "/memberships" },
  clickTarget: "button",
  active: true,
  startsAt: null,
  endsAt: null,
};
const SLIDER: SliderState = { settings: DEFAULT_SLIDER_SETTINGS, slides: [SLIDE] };

describe("الشريط في الإصدار (ADMIN_A3_SLIDER §7)", () => {
  it("يدخل اللقطة وعدّ التغييرات، والمسودة متغيرة بشريحة وحدها", () => {
    const built = buildRelease([], null, SLIDER, context);
    expect(built).toMatchObject({ ok: true, value: { changedCount: 1, slider: SLIDER } });
    const published = built.ok ? built.value.snapshot : null;
    expect(published?.slider?.slides).toHaveLength(1);
    expect(isDraftDirty([], published, SLIDER, registry)).toBe(false);
    expect(isDraftDirty([], published, EMPTY_SLIDER, registry)).toBe(true);
    expect(rebuildRelease(published, null, context)).toMatchObject({
      ok: true,
      value: { changedCount: 1 },
    });
  });

  it("رابط داخلي لم يعد معروفًا يرفض النشر والاسترجاع", () => {
    const stale = { registry, knownPaths: new Set(["/"]) };
    expect(buildRelease([], null, SLIDER, stale)).toMatchObject({
      ok: false,
      error: { reason: "content.slider_invalid" },
    });
    const built = buildRelease([], null, SLIDER, context);
    expect(rebuildRelease(built.ok ? built.value.snapshot : null, null, stale)).toMatchObject({
      ok: false,
      error: { reason: "content.slider_invalid" },
    });
  });
});
