import { SETTING_IDS, SETTINGS, toForm } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { SITE_SETTING_DEFAULTS } from "./index";

const context = { knownPaths: new Set<string>() };

describe("افتراضيات الإعدادات المنظَّمة", () => {
  it.each(SETTING_IDS)("%s يمر بتحقق الحفظ كاملًا ويطابق شكله القانوني", (id) => {
    const checked = SETTINGS[id].validate(SITE_SETTING_DEFAULTS[id], context);
    expect(checked.ok ? [] : checked.error).toEqual([]);
    expect(checked.ok && checked.value).toEqual(SITE_SETTING_DEFAULTS[id]);
  });

  it("لا بند «بانتظار تأكيد المالك» ظاهر في الافتراضي", () => {
    for (const id of SETTING_IDS) {
      const flat = toForm(SETTINGS[id].shape, SITE_SETTING_DEFAULTS[id]);
      const pending = Object.keys(flat).filter(
        (field) => field.endsWith(".pending") && flat[field] === "1",
      );
      for (const field of pending) {
        expect(flat[field.replace(/pending$/, "visible")], `${id} ${field}`).toBe("");
      }
    }
  });

  it("ما لم يؤكده المالك لا يُنشر افتراضيًا", () => {
    const d = SITE_SETTING_DEFAULTS;
    expect(d["club.contact"].email).toBe("");
    expect(d["club.rating"].show).toBe(false);
    expect(d["club.facts"]).toMatchObject({
      machinesOver: "",
      commercialRegistration: "",
      showCommercialRegistration: false,
      showVatNumber: false,
    });
    expect(d["club.paymentMarks"]).toMatchObject({ stcPay: false, tabby: false, tamara: false });
    expect(d["legal.terms"].published || d["legal.returns"].published).toBe(false);
    expect(d["home.sections"].friendsOffer).toBe(false);
    expect(d["home.testimonials"].items.every((item) => !item.visible && item.author === "")).toBe(
      true,
    );
    expect(d["home.faq"].items.every((item) => !item.visible && item.pending)).toBe(true);
    expect(d["club.hours"].specials).toEqual([]);
    expect(d["site.announcement"].enabled).toBe(false);
  });

  it("العنوان المؤكد من ملف Google: الدائري الغربي", () => {
    const contact = SITE_SETTING_DEFAULTS["club.contact"];
    expect(contact.street.ar).toContain("الطريق الدائري الغربي");
    expect(contact.street.en).toContain("Western Ring Road");
    expect(contact.mapUrl).toBe("https://maps.app.goo.gl/YBbFEXF2StKmbn137");
    expect(contact.plusCode).toBe("CW53+4G");
    expect([contact.latitude, contact.longitude]).toEqual(["26.4077931", "43.9038318"]);
  });

  it("لا سعر ولا مبلغ في أي نص افتراضي خارج الصفحتين القانونيتين", () => {
    const ids = SETTING_IDS.filter((id) => !id.startsWith("legal."));
    for (const id of ids) {
      const texts = Object.values(toForm(SETTINGS[id].shape, SITE_SETTING_DEFAULTS[id])).join(" ");
      expect(texts, id).not.toMatch(/ريال|ر\.س|\bSAR\b|riyal/i);
    }
  });
});
