import { describe, expect, it } from "vitest";
import { directionOf, isLocale, localizedPath } from "./locales";

describe("locales", () => {
  it("يميّز اللغات المدعومة فقط", () => {
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it("اتجاه كل لغة", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });

  it("الرابط العام: العربية بلا بادئة والإنجليزية ببادئة", () => {
    expect(localizedPath("ar")).toBe("/");
    expect(localizedPath("ar", "/memberships")).toBe("/memberships");
    expect(localizedPath("en")).toBe("/en");
    expect(localizedPath("en", "/memberships")).toBe("/en/memberships");
    expect(localizedPath("en", "memberships")).toBe("/en/memberships");
  });

  it("مرساة أو استعلام على الجذر بلا شرطة زائدة بعد بادئة اللغة", () => {
    expect(localizedPath("ar", "/#water")).toBe("/#water");
    expect(localizedPath("en", "/#water")).toBe("/en#water");
    expect(localizedPath("en", "/?a=1")).toBe("/en?a=1");
    expect(localizedPath("en", "/memberships#compare")).toBe("/en/memberships#compare");
  });
});
