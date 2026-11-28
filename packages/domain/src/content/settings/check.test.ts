import { describe, expect, it } from "vitest";
import { checkShape } from "./check";
import { fromForm, labelPath, shapeFieldNames, toForm } from "./form";
import { daySpan, displaySaudiPhone, isCalendarDate } from "./formats";
import { bool, choice, group, list, localized, text, url } from "./spec";

const LABEL_MAX = 20;
const LIST_MAX = 2;
const SHAPE = {
  phone: text("phone", LABEL_MAX, true),
  email: text("email", 60),
  map: url(["maps.app.goo.gl"]),
  title: localized(LABEL_MAX, "ar"),
  body: localized(200, "none", { multiline: true }),
  on: bool(),
  tone: choice(["a", "b"]),
  slot: group({ opens: text("time", 5, true) }),
  items: list({ name: localized(LABEL_MAX, "both"), visible: bool() }, LIST_MAX),
};

const VALID = {
  phone: "+966163240111",
  email: "",
  map: "https://maps.app.goo.gl/YBbFEXF2StKmbn137",
  title: { ar: "عنوان", en: "" },
  body: { ar: "", en: "" },
  on: true,
  tone: "b",
  slot: { opens: "06:00" },
  items: [{ name: { ar: "ساونا", en: "Sauna" }, visible: true }],
};

function issuesOf(raw: unknown, lint = true) {
  const checked = checkShape(SHAPE, raw, { lint });
  return checked.ok ? [] : checked.error.map((issue) => `${issue.field}:${issue.reason}`);
}

describe("checkShape", () => {
  it("يقبل قيمة صحيحة ويعيدها بترتيب الشكل", () => {
    const checked = checkShape(SHAPE, { ...VALID, extra: 1 }, { lint: true });
    expect(checked.ok && Object.keys(checked.value)).toEqual(Object.keys(SHAPE));
    expect(checked.ok && checked.value.items[0]?.name.en).toBe("Sauna");
  });

  it("يطبّع الهاتف والأرقام العربية", () => {
    const checked = checkShape(SHAPE, { ...VALID, phone: "+966 16 324 0111" }, { lint: true });
    expect(checked.ok && checked.value.phone).toBe("+966163240111");
  });

  it.each([
    [{ phone: "" }, "phone:settings.required"],
    [{ phone: "12345" }, "phone:settings.format_phone"],
    [{ email: "not-an-email" }, "email:settings.format_email"],
    [{ map: "https://evil.example/maps" }, "map:settings.format_url"],
    [{ map: "http://maps.app.goo.gl/x" }, "map:settings.format_url"],
    [{ title: { ar: "", en: "x" } }, "title.ar:settings.required"],
    [{ title: { ar: "نص أطول من الحد المسموح به هنا", en: "" } }, "title.ar:content.too_long"],
    [{ title: { ar: "سطر\nثانٍ", en: "" } }, "title.ar:content.multiline"],
    [{ title: { ar: "<b>نص</b>", en: "" } }, "title.ar:settings.markup"],
    [{ title: { ar: "السعر 100 ريال", en: "" } }, "title.ar:settings.no_price"],
    [{ title: { ar: "نص ,خطأ", en: "" } }, "title.ar:content.copy_lint"],
    [{ on: "yes" }, "on:settings.shape"],
    [{ tone: "c" }, "tone:settings.choice"],
    [{ slot: { opens: "25:00" } }, "slot.opens:settings.format_time"],
    [{ items: "x" }, "items:settings.shape"],
    [{ items: [VALID.items[0], VALID.items[0], VALID.items[0]] }, "items:settings.list_too_long"],
    [
      { items: [{ name: { ar: "اسم", en: "" }, visible: true }] },
      "items.0.name.en:settings.required",
    ],
  ])("يرفض %j", (patch, expected) => {
    expect(issuesOf({ ...VALID, ...patch })).toContain(expected);
  });

  it("قراءة اللقطة بلا تدقيق النصوص: قاعدة تدقيق لا تُسقط إعدادًا", () => {
    expect(issuesOf({ ...VALID, title: { ar: "نص ,خطأ", en: "" } }, false)).toEqual([]);
    expect(issuesOf({ ...VALID, title: { ar: "<b>", en: "" } }, false)).not.toEqual([]);
  });

  it("الفقرات المتعددة تُشذَّب سطرًا سطرًا", () => {
    const checked = checkShape(
      SHAPE,
      { ...VALID, body: { ar: " فقرة أولى. \n\n فقرة ثانية. ", en: "" } },
      { lint: true },
    );
    expect(checked.ok && checked.value.body.ar).toBe("فقرة أولى.\nفقرة ثانية.");
  });

  it("غير الكائن مرفوض", () => {
    expect(issuesOf(null)).toContain(":settings.shape");
  });
});

describe("النموذج المسطّح", () => {
  it("toForm ثم fromForm يعيدان القيمة نفسها", () => {
    const checked = checkShape(SHAPE, VALID, { lint: true });
    const value = checked.ok ? checked.value : null;
    expect(value).not.toBeNull();
    const flat = toForm(SHAPE, value ?? {});
    expect(flat["items.n"]).toBe("1");
    expect(flat["items.0.name.ar"]).toBe("ساونا");
    expect(flat.on).toBe("1");
    expect(checkShape(SHAPE, fromForm(SHAPE, flat), { lint: true })).toEqual(checked);
  });

  it("عدد القائمة من النموذج لا يتجاوز الحد إلا بواحد", () => {
    const raw = fromForm(SHAPE, { "items.n": "999" });
    expect(Array.isArray(raw.items) && raw.items.length).toBe(LIST_MAX + 1);
    expect(fromForm(SHAPE, { "items.n": "-3" }).items).toEqual([]);
  });

  it("أسماء الحقول ومسار التسمية", () => {
    expect(shapeFieldNames(SHAPE)).toEqual(
      expect.arrayContaining(["phone", "title.ar", "slot.opens", "items.n"]),
    );
    expect(labelPath("items.2.name.ar")).toBe("items.name.ar");
  });
});

describe("الصيغ", () => {
  it("التاريخ يوم تقويمي حقيقي", () => {
    expect(isCalendarDate("2027-02-28")).toBe(true);
    expect(isCalendarDate("2027-02-30")).toBe(false);
    expect(isCalendarDate("2027-2-1")).toBe(false);
  });

  it("عدد الأيام شامل الطرفين", () => {
    expect(daySpan("2027-02-08", "2027-02-08")).toBe(1);
    expect(daySpan("2027-02-08", "2027-03-09")).toBe(30);
    expect(daySpan("2027-02-08", "x")).toBeNull();
  });

  it("الهاتف كما يُعرض محليًا", () => {
    expect(displaySaudiPhone("+966163240111")).toBe("016 324 0111");
  });
});
