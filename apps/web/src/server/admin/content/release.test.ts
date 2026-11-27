import type { DraftRow } from "@masar/db";
import { buildSnapshot } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { textRegistry } from "../../content/registry";
import { buildRelease, isDraftDirty, rebuildRelease } from "./release";

/**
 * مراجعة A3 (القرار 73): التجاوز المساوي للافتراضي لا يمنع النشر، والمسودة لا تصير «متغيرة» لأن الكود
 * منع مفتاحًا أو حذفه بعد النشر، والاسترجاع يمر بتحقق النشر نفسه.
 */
const registry = textRegistry();
const HASH = "a".repeat(64);
const at = new Date("2026-11-28T10:00:00Z");

function row(path: string, value: string, locale = "ar"): DraftRow {
  return {
    key: `text:${path}`,
    locale,
    value: { value, baseHash: HASH },
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
    const built = buildRelease(rows, null, registry);
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
    expect(isDraftDirty(rows, published, registry)).toBe(false);
    expect(isDraftDirty([row("hero.slogan", "غيرها.")], published, registry)).toBe(true);
    expect(isDraftDirty([], null, registry)).toBe(false);
  });
});

describe("الاسترجاع بتحقق النشر", () => {
  it("لقطة قديمة تخالف التدقيق الحالي مرفوضة، والسليمة تُبنى بالسجل الحالي", () => {
    const refused = rebuildRelease(snapshot({ "hero.title": "أقوى  نسخة" }), null, registry);
    expect(refused).toMatchObject({ ok: false, error: { reason: "content.draft_invalid" } });
    const rebuilt = rebuildRelease(
      snapshot({ "hero.title": "عنوان", "hero.pause": "قف" }),
      snapshot({ "hero.title": "عنوان" }),
      registry,
    );
    expect(rebuilt).toMatchObject({ ok: true, value: { changedCount: 0 } });
  });
});
