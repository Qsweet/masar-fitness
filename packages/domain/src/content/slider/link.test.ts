import { describe, expect, it } from "vitest";
import { isStoredLink, parseExternalUrl, parseSlideLink } from "./link";
import { KNOWN_PATHS } from "./test-fixtures";

const external = (url: string) =>
  parseSlideLink({ kind: "external", internal: "", external: url, newTab: true }, KNOWN_PATHS);

describe("parseExternalUrl", () => {
  it("يقبل https بمضيف صحيح ويطبّع المضيف صغيرًا ويبقي المسار كما هو", () => {
    expect(parseExternalUrl(" https://Example.COM/Path?q=1#top ")).toEqual({
      ok: true,
      value: "https://example.com/Path?q=1#top",
    });
    expect(parseExternalUrl("https://xn--mgbh0fb.xn--kgbechtv/")).toMatchObject({ ok: true });
  });

  it.each([
    ["javascript:alert(1)", "slider.link_https_only"],
    ["JavaScript:alert(1)", "slider.link_https_only"],
    ["data:text/html;base64,PHNjcmlwdD4=", "slider.link_https_only"],
    ["http://example.com", "slider.link_https_only"],
    ["//example.com/x", "slider.link_https_only"],
    ["ftp://example.com", "slider.link_https_only"],
    ["https://user:pass@example.com", "slider.link_invalid"],
    ["https://user@example.com", "slider.link_invalid"],
    ["https://example.com:8443/", "slider.link_invalid"],
    ["https://127.0.0.1/", "slider.link_invalid"],
    ["https://localhost/", "slider.link_invalid"],
    ["https:///path", "slider.link_invalid"],
    ["https://exa mple.com", "slider.link_invalid"],
    ["https://example.com/a b", "slider.link_invalid"],
    ["https://example.com/‮evil", "slider.link_invalid"],
    ["https://example.com/<script>", "slider.link_invalid"],
    ["", "slider.link_required"],
    [`https://example.com/${"a".repeat(500)}`, "slider.link_too_long"],
  ])("يرفض %s", (url, reason) => {
    expect(parseExternalUrl(url)).toEqual({ ok: false, error: reason });
  });
});

describe("parseSlideLink", () => {
  it("الداخلي من القائمة المعروفة حرفيًا وحدها", () => {
    const internal = (path: string) =>
      parseSlideLink(
        { kind: "internal", internal: path, external: "", newTab: false },
        KNOWN_PATHS,
      );
    expect(internal("/memberships")).toEqual({
      ok: true,
      value: { kind: "internal", path: "/memberships" },
    });
    expect(internal("/#plans")).toMatchObject({ ok: true });
    expect(internal("/admin")).toEqual({ ok: false, error: "slider.link_unknown" });
    expect(internal("https://example.com")).toEqual({ ok: false, error: "slider.link_unknown" });
    expect(internal("")).toEqual({ ok: false, error: "slider.link_required" });
    // حتى لو دخل القائمة خطأً، الشكل يُفحص أولًا
    const sneaky = parseSlideLink(
      { kind: "internal", internal: "/\\evil.com", external: "", newTab: false },
      new Set(["/\\evil.com"]),
    );
    expect(sneaky).toEqual({ ok: false, error: "slider.link_unknown" });
  });

  it("الخارجي يحمل اختيار اللسان الجديد، والنوع المجهول مرفوض", () => {
    expect(external("https://example.com")).toEqual({
      ok: true,
      value: { kind: "external", url: "https://example.com", newTab: true },
    });
    expect(
      parseSlideLink({ kind: "mailto", internal: "", external: "", newTab: false }, KNOWN_PATHS),
    ).toEqual({ ok: false, error: "slider.link_kind_unknown" });
    expect(
      parseSlideLink({ kind: "none", internal: "/x", external: "y", newTab: true }, KNOWN_PATHS),
    ).toEqual({ ok: true, value: { kind: "none" } });
  });
});

describe("isStoredLink", () => {
  it("يرفض المحفوظ بغير شكله القانوني", () => {
    expect(isStoredLink({ kind: "external", url: "https://Example.com", newTab: false })).toBe(
      false,
    );
    expect(isStoredLink({ kind: "external", url: "javascript:x", newTab: false })).toBe(false);
    expect(isStoredLink({ kind: "internal", path: "//evil.example" })).toBe(false);
    expect(isStoredLink({ kind: "internal", path: "/memberships" })).toBe(true);
    expect(isStoredLink({ kind: "internal", path: "/memberships/plan-12#top" })).toBe(true);
    for (const path of [
      "/\\evil.com",
      "/%5cevil.com",
      "/a//b",
      "/Memberships",
      "/a b",
      "javascript:x",
    ]) {
      expect(isStoredLink({ kind: "internal", path }), path).toBe(false);
    }
  });
});
