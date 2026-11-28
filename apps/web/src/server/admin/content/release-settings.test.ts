import type { DraftRow } from "@masar/db";
import { EMPTY_SLIDER, settingKey, SETTING_LOCALE, type SettingId } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { SITE_SETTING_DEFAULTS } from "@/config/site-settings";
import { textRegistry } from "../../content/registry";
import { buildRelease, draftDigest, isDraftDirty, rebuildRelease } from "./release";

/** الإعدادات المنظَّمة في الإصدار (ADMIN_A3_CONTENT §5، القرار 95): لقطة وبصمة وفرق وتعريف واحد للتغيّر. */
const registry = textRegistry();
const context = { registry, knownPaths: new Set(["/", "/memberships"]) };
const at = new Date("2026-11-28T10:00:00Z");

function settingRow(id: SettingId, raw: unknown): DraftRow {
  return {
    key: settingKey(id),
    locale: SETTING_LOCALE,
    value: null,
    raw,
    lockToken: "1",
    updatedBy: "s",
    updatedAt: at,
  };
}

const SOCIAL = { ...SITE_SETTING_DEFAULTS["club.social"], instagram: "" };
const ANNOUNCEMENT = {
  ...SITE_SETTING_DEFAULTS["site.announcement"],
  enabled: true,
  text: { ar: "عرض جديد على الاشتراكات", en: "A new membership offer" },
  linkKind: "internal",
  linkPath: "/memberships",
  linkLabel: { ar: "الاشتراكات", en: "Memberships" },
};

describe("الإعدادات في الإصدار", () => {
  it("تدخل اللقطة وعدّ التغييرات ورقة ورقة", () => {
    const built = buildRelease([settingRow("club.social", SOCIAL)], null, EMPTY_SLIDER, context);
    expect(built).toMatchObject({ ok: true, value: { changedCount: 1 } });
    expect(built.ok ? built.value.snapshot.settings : null).toEqual({ "club.social": SOCIAL });
  });

  it("المسودة متغيرة بإعداد وحده، ونظيفة حين تطابق المنشور أو الافتراضي", () => {
    const rows = [settingRow("club.social", SOCIAL)];
    const built = buildRelease(rows, null, EMPTY_SLIDER, context);
    const published = built.ok ? built.value.snapshot : null;
    expect(isDraftDirty(rows, null, EMPTY_SLIDER, registry)).toBe(true);
    expect(isDraftDirty(rows, published, EMPTY_SLIDER, registry)).toBe(false);
    expect(isDraftDirty([], published, EMPTY_SLIDER, registry)).toBe(true);
    const same = [settingRow("club.social", SITE_SETTING_DEFAULTS["club.social"])];
    expect(isDraftDirty(same, null, EMPTY_SLIDER, registry)).toBe(false);
  });

  it("البصمة تتغير بالإعداد، وصف «عودة إلى الافتراضي» لا يغيّرها", () => {
    const empty = draftDigest([], registry, EMPTY_SLIDER);
    expect(draftDigest([settingRow("club.social", SOCIAL)], registry, EMPTY_SLIDER)).not.toBe(
      empty,
    );
    expect(draftDigest([settingRow("club.social", null)], registry, EMPTY_SLIDER)).toBe(empty);
  });

  it("إعداد معطّل (شكل لا يطابق السجل) لا يُنشر ولا يُعدّ", () => {
    const built = buildRelease([settingRow("club.social", { x: 5 })], null, EMPTY_SLIDER, context);
    expect(built).toMatchObject({ ok: true, value: { changedCount: 0 } });
    expect(built.ok ? built.value.snapshot.settings : "x").toBeUndefined();
  });

  it("إعداد يخالف قواعد اليوم يرفض النشر والاسترجاع كله", () => {
    const stale = { registry, knownPaths: new Set(["/"]) };
    const rows = [settingRow("site.announcement", ANNOUNCEMENT)];
    expect(buildRelease(rows, null, EMPTY_SLIDER, stale)).toMatchObject({
      ok: false,
      error: { reason: "content.setting_invalid", field: "site.announcement" },
    });
    const built = buildRelease(rows, null, EMPTY_SLIDER, context);
    expect(built.ok).toBe(true);
    expect(rebuildRelease(built.ok ? built.value.snapshot : null, null, stale)).toMatchObject({
      ok: false,
      error: { reason: "content.setting_invalid" },
    });
  });

  it("بند ظاهر بانتظار تأكيد المالك لا يُنشر", () => {
    const [first] = SITE_SETTING_DEFAULTS["home.faq"].items;
    const faq = { items: [{ ...first, visible: true, pending: true }] };
    expect(buildRelease([settingRow("home.faq", faq)], null, EMPTY_SLIDER, context)).toMatchObject({
      ok: false,
      error: { reason: "content.setting_invalid", field: "home.faq" },
    });
  });
});
