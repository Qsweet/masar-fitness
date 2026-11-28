import { describe, expect, it } from "vitest";
import { activeHours, checkHours, upcomingPeriods, type HoursSetting } from "./defs/hours";
import {
  checkAnnouncement,
  checkSections,
  checkTestimonials,
  HOME_SECTION_IDS,
  isAnnouncementLive,
  pendingIssues,
  visibleSections,
  type AnnouncementSetting,
} from "./defs/home";
import { checkContact, checkFacts, checkRating } from "./defs/club";
import { checkLegal } from "./defs/pages";
import { isSettingId, SETTING_IDS, SETTINGS } from "./registry";

const AREA = {
  satThu: { opens: "06:00", closes: "02:00" },
  fri: { opens: "13:00", closes: "00:00" },
};
const period = (from: string, to: string, closed = false) => ({
  name: { ar: "رمضان", en: "Ramadan" },
  from,
  to,
  closed,
  gym: AREA,
  pool: AREA,
});
const hours = (specials: HoursSetting["specials"]): HoursSetting => ({
  gym: AREA,
  pool: AREA,
  specials,
});
const reasons = (issues: readonly { field: string; reason: string }[]) =>
  issues.map((issue) => `${issue.field}:${issue.reason}`);

describe("الأوقات", () => {
  it("فترة رمضان مع العيد (أكثر من 60 يومًا) مقبولة حتى 100 يوم", () => {
    expect(checkHours(hours([period("2027-02-08", "2027-04-15")]))).toEqual([]);
    expect(reasons(checkHours(hours([period("2027-02-08", "2027-06-30")])))).toEqual([
      "specials.0.to:settings.period_too_long",
    ]);
  });

  it("نهاية قبل البداية، وتداخل فترتين", () => {
    expect(reasons(checkHours(hours([period("2027-03-10", "2027-03-01")])))).toEqual([
      "specials.0.to:settings.range_order",
    ]);
    const overlapping = hours([
      period("2027-02-08", "2027-03-09"),
      period("2027-03-09", "2027-03-12"),
    ]);
    expect(reasons(checkHours(overlapping))).toEqual(["specials.1.from:settings.period_overlap"]);
  });

  it("الأوقات السارية: الفترة الخاصة في مداها، والمعتاد خارجه", () => {
    const value = hours([period("2027-02-08", "2027-03-09")]);
    expect(activeHours(value, "2027-02-07").special).toBeNull();
    expect(activeHours(value, "2027-02-08").special?.name.ar).toBe("رمضان");
    expect(activeHours(value, "2027-03-09").special).not.toBeNull();
    expect(activeHours(value, "2027-03-10").special).toBeNull();
  });

  it("الفترات القادمة بلا المنتهية، مرتبة", () => {
    const value = hours([period("2027-03-10", "2027-03-12"), period("2027-02-08", "2027-03-09")]);
    expect(upcomingPeriods(value, "2027-03-10").map((item) => item.from)).toEqual(["2027-03-10"]);
    expect(upcomingPeriods(value, "2027-01-01").map((item) => item.from)).toEqual([
      "2027-02-08",
      "2027-03-10",
    ]);
  });
});

describe("أقسام الرئيسية", () => {
  const all = HOME_SECTION_IDS.map((id) => ({ id, visible: true }));

  it("الترتيب الكامل مقبول، والظاهر بترتيبه", () => {
    const value = { friendsOffer: false, items: [...all].reverse() };
    expect(checkSections(value)).toEqual([]);
    expect(visibleSections(value)[0]).toBe("contact");
  });

  it("قسم ناقص أو مكرر مرفوض", () => {
    expect(reasons(checkSections({ friendsOffer: false, items: all.slice(1) }))).toEqual([
      "items:settings.sections_incomplete",
    ]);
    const doubled = [...all.slice(1), { id: "faq" as const, visible: true }];
    expect(checkSections({ friendsOffer: false, items: doubled })).toHaveLength(1);
  });

  it("الإلزامي لا يُخفى", () => {
    const items = all.map((item) => (item.id === "contact" ? { ...item, visible: false } : item));
    expect(reasons(checkSections({ friendsOffer: false, items }))).toEqual([
      "items.12.visible:settings.section_required",
    ]);
  });
});

describe("البنود المعلّقة والموافقة", () => {
  it("بند ظاهر بانتظار تأكيد المالك مرفوض", () => {
    const items = [
      { visible: true, pending: false },
      { visible: true, pending: true },
      { visible: false, pending: true },
    ];
    expect(reasons(pendingIssues(items, "items"))).toEqual([
      "items.1.visible:settings.pending_visible",
    ]);
  });

  it("رأي ظاهر بلا موافقة مرفوض", () => {
    const item = { quote: { ar: "ممتاز", en: "" }, author: "", source: "google" as const };
    const value = {
      items: [
        { ...item, consent: false, visible: true },
        { ...item, consent: true, visible: true },
        { ...item, consent: false, visible: false },
      ],
    };
    expect(reasons(checkTestimonials(value))).toEqual([
      "items.0.consent:settings.consent_required",
    ]);
  });
});

describe("شريط الإعلان", () => {
  const base: AnnouncementSetting = {
    enabled: true,
    text: { ar: "عرض جديد", en: "New offer" },
    linkKind: "none",
    linkPath: "",
    linkLabel: { ar: "", en: "" },
    from: "2027-01-01",
    to: "2027-01-31",
    dismissible: true,
  };
  const known = new Set(["/memberships"]);

  it("مفعَّل بنصّيه ونافذته", () => {
    expect(checkAnnouncement(base, known)).toEqual([]);
  });

  it("مفعَّل بلا نص، ورابط داخلي مجهول أو بلا تسمية", () => {
    const empty = { ...base, text: { ar: "", en: "" } };
    expect(reasons(checkAnnouncement(empty, known))).toEqual([
      "text.ar:settings.required",
      "text.en:settings.required",
    ]);
    const linked = { ...base, linkKind: "internal" as const, linkPath: "/nowhere" };
    expect(reasons(checkAnnouncement(linked, known))).toEqual([
      "linkLabel.ar:settings.required",
      "linkLabel.en:settings.required",
      "linkPath:slider.link_unknown",
    ]);
  });

  it("النافذة: الترتيب والحد 90 يومًا", () => {
    expect(reasons(checkAnnouncement({ ...base, to: "2026-12-31" }, known))).toEqual([
      "to:settings.range_order",
    ]);
    expect(reasons(checkAnnouncement({ ...base, to: "2027-06-01" }, known))).toEqual([
      "to:settings.window_too_long",
    ]);
  });

  it("يسري داخل نافذته وحدها، والطرف الفارغ مفتوح", () => {
    expect(isAnnouncementLive(base, "2026-12-31")).toBe(false);
    expect(isAnnouncementLive(base, "2027-01-01")).toBe(true);
    expect(isAnnouncementLive(base, "2027-02-01")).toBe(false);
    expect(isAnnouncementLive({ ...base, from: "", to: "" }, "2030-01-01")).toBe(true);
    expect(isAnnouncementLive({ ...base, enabled: false }, "2027-01-10")).toBe(false);
  });
});

describe("حقائق النادي", () => {
  const contact = {
    phone: "+966163240111",
    whatsapp: "+966553240111",
    email: "",
    street: { ar: "شارع", en: "Street" },
    locality: { ar: "بريدة", en: "Buraidah" },
    postalCode: "52581",
    latitude: "26.4077931",
    longitude: "43.9038318",
    mapUrl: "https://maps.app.goo.gl/YBbFEXF2StKmbn137",
    directionsUrl: "",
    plusCode: "CW53+4G",
  };

  it("الإحداثيات داخل المملكة والرمز البريدي خمسة أرقام", () => {
    expect(checkContact(contact)).toEqual([]);
    expect(reasons(checkContact({ ...contact, latitude: "51.5", postalCode: "123" }))).toEqual([
      "latitude:settings.coordinate_range",
      "postalCode:settings.format_digits",
    ]);
  });

  it("مفتاح العرض يحتاج رقمه، والرقم الضريبي 15 رقمًا", () => {
    const facts = {
      foundedYear: "2018",
      machinesOver: "",
      commercialRegistration: "",
      showCommercialRegistration: true,
      vatNumber: "123",
      showVatNumber: false,
    };
    expect(reasons(checkFacts(facts))).toEqual([
      "showCommercialRegistration:settings.show_needs_value",
      "vatNumber:settings.vat_length",
    ]);
  });

  it("التقييم لا يُعرض بلا قيمته وعدده وتاريخه", () => {
    const rating = { show: true, value: "4.5", count: "", asOf: "" };
    expect(reasons(checkRating(rating))).toEqual([
      "count:settings.required",
      "asOf:settings.required",
    ]);
    expect(checkRating({ ...rating, show: false })).toEqual([]);
  });
});

describe("الصفحة القانونية", () => {
  const draft = {
    published: false,
    reviewed: false,
    updatedOn: "",
    intro: { ar: "", en: "" },
    sections: [],
  };

  it("المسودة مقبولة، والنشر يشترط المراجعة والتاريخ وقسمًا", () => {
    expect(checkLegal(draft)).toEqual([]);
    expect(reasons(checkLegal({ ...draft, published: true }))).toEqual([
      "published:settings.legal_review_required",
      "updatedOn:settings.required",
      "sections:settings.list_empty",
    ]);
  });
});

describe("السجل", () => {
  it("المعرّفات معروفة وما سواها مرفوض", () => {
    expect(SETTING_IDS).toContain("club.hours");
    expect(isSettingId("club.hours")).toBe(true);
    expect(isSettingId("toString")).toBe(false);
  });

  it("الحقائق والقانون بصلاحية الحقائق، والباقي بالكتابة", () => {
    expect(SETTINGS["club.contact"].permission).toBe("content.facts");
    expect(SETTINGS["legal.terms"].permission).toBe("content.facts");
    expect(SETTINGS["home.faq"].permission).toBe("content.write");
  });

  it("التحقق يطبّق القواعد المترابطة بعد الحقول", () => {
    const context = { knownPaths: new Set<string>() };
    const item = { question: { ar: "سؤال؟", en: "" }, answer: { ar: "جواب.", en: "" } };
    const bad = { items: [{ ...item, visible: true, pending: true }] };
    const checked = SETTINGS["home.faq"].validate(bad, context);
    expect(checked.ok ? [] : reasons(checked.error)).toEqual([
      "items.0.visible:settings.pending_visible",
    ]);
    const good = { items: [{ ...item, visible: true, pending: false }] };
    expect(SETTINGS["home.faq"].validate(good, context).ok).toBe(true);
  });
});
