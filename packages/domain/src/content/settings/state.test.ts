import { describe, expect, it } from "vitest";
import { contentDigest } from "../diff";
import { buildSnapshot, snapshotSettings, snapshotShape } from "../snapshot";
import { diffSettings, draftSettings, parseSettings, settingKey, settingsJson } from "./state";
import type { SettingValues } from "./registry";

const SOCIAL = { instagram: "https://www.instagram.com/club", x: "", snapchat: "", tiktok: "" };
const LOCATION = { parking: { ar: "مواقف أمام النادي.", en: "" }, arrival: { ar: "", en: "" } };
const hash = (text: string) => String(text.length);
// الافتراضيات الكاملة في الويب؛ هنا ما تلمسه الاختبارات وحده
const DEFAULTS = {
  "club.social": { instagram: "", x: "", snapchat: "", tiktok: "" },
  "page.location": { parking: { ar: "", en: "" }, arrival: { ar: "", en: "" } },
} as unknown as SettingValues;

describe("إعدادات اللقطة", () => {
  it("تُقرأ بالسجل، وما لا يطابقه يُسقط", () => {
    const parsed = parseSettings({
      "club.social": SOCIAL,
      "page.location": { parking: 5 },
      "unknown.setting": {},
    });
    expect([...parsed.settings.keys()]).toEqual(["club.social"]);
    expect(parsed.dropped).toEqual(["setting:page.location", "setting:unknown.setting"]);
  });

  it("الشكل القانوني بترتيب السجل لا بترتيب الكتابة", () => {
    const a = parseSettings({ "page.location": LOCATION, "club.social": SOCIAL }).settings;
    const b = parseSettings({ "club.social": SOCIAL, "page.location": LOCATION }).settings;
    expect(Object.keys(settingsJson(a))).toEqual(["club.social", "page.location"]);
    expect(contentDigest(new Map(), hash, undefined, a)).toBe(
      contentDigest(new Map(), hash, undefined, b),
    );
  });

  it("لقطة بلا إعدادات بصمتها كما كانت قبلها", () => {
    expect(buildSnapshot(new Map())).toEqual({ v: 1, texts: {} });
    expect(snapshotSettings({ v: 1, texts: {} }).settings.size).toBe(0);
    expect(
      snapshotSettings({ v: 2, texts: {}, settings: { "club.social": SOCIAL } }).settings.size,
    ).toBe(0);
  });

  it("اللقطة تحمل الإعدادات وتعيدها", () => {
    const settings = parseSettings({ "club.social": SOCIAL }).settings;
    const snapshot = buildSnapshot(new Map(), undefined, settings);
    expect(snapshotSettings(snapshot).settings.get("club.social")).toEqual(SOCIAL);
    expect(snapshotShape(snapshot)?.settings).toEqual({ "club.social": SOCIAL });
  });
});

describe("إعدادات المسودة", () => {
  const row = (key: string, raw: unknown) => ({ key, locale: "*", value: null, raw });

  it("صفوف setting: وحدها، والفارغ عودة إلى الافتراضي", () => {
    const parsed = draftSettings([
      row(settingKey("club.social"), SOCIAL),
      row(settingKey("page.location"), null),
      row("text:hero.title", { value: "x", baseHash: "y" }),
    ]);
    expect([...parsed.settings.keys()]).toEqual(["club.social"]);
    expect(parsed.dropped).toEqual([]);
  });
});

describe("فرق الإعدادات", () => {
  it("ورقة ورقة مقارنةً بالافتراضي حين لا تجاوز", () => {
    const after = parseSettings({ "club.social": SOCIAL }).settings;
    expect(diffSettings(new Map(), after, DEFAULTS)).toEqual([
      { id: "club.social", field: "instagram", before: "", after: SOCIAL.instagram },
    ]);
    expect(diffSettings(after, new Map(), DEFAULTS)).toEqual([
      { id: "club.social", field: "instagram", before: SOCIAL.instagram, after: "" },
    ]);
    expect(diffSettings(after, after, DEFAULTS)).toEqual([]);
  });

  it("تجاوز يساوي الافتراضي ليس تغييرًا", () => {
    const same = parseSettings({ "club.social": DEFAULTS["club.social"] }).settings;
    expect(diffSettings(new Map(), same, DEFAULTS)).toEqual([]);
  });
});
