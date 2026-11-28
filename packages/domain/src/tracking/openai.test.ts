import { describe, expect, it } from "vitest";
import { touchFromQuery } from "./attribution";
import { isTooOld } from "./delivery";
import { opprefCookie } from "./identifiers";
import { pixelEventName } from "./events";
import {
  isCompleteConfig,
  parseIntegrationConfig,
  requiresAamConfirmation,
  sendsHashedPhone,
} from "./ids";
import { isServerProvider, providerCategories } from "./providers";

describe("إعلانات ChatGPT (OpenAI، القرار 91)", () => {
  it("منصة إعلانات بالبكسل والخادم", () => {
    expect(providerCategories("openai")).toEqual(["ads"]);
    expect(isServerProvider("openai")).toBe(true);
    expect(sendsHashedPhone("openai", {})).toBe(true);
    expect(sendsHashedPhone("openai", { sendHashedPhone: false })).toBe(false);
  });

  it("أسماء الأحداث القياسية الموثَّقة", () => {
    expect(pixelEventName("openai", "page_view")).toBe("page_viewed");
    expect(pixelEventName("openai", "add_to_cart")).toBe("items_added");
    expect(pixelEventName("openai", "begin_checkout")).toBe("checkout_started");
    expect(pixelEventName("openai", "generate_lead")).toBe("lead_created");
    expect(pixelEventName("openai", "purchase")).toBe("order_created");
  });

  it("Pixel ID بمحارف آمنة وطول محدود، مثبَّت الطرفين", () => {
    expect(parseIntegrationConfig("openai", { pixelId: "134534abc_-Z" }, true).issues).toEqual({});
    for (const bad of ["12345", "abc'def", "abc def12", "a".repeat(65), "123\n4567", "<x>12345"]) {
      expect(parseIntegrationConfig("openai", { pixelId: bad }, false).issues).toEqual({
        pixelId: "invalid",
      });
    }
    expect(parseIntegrationConfig("openai", {}, true).issues).toEqual({ pixelId: "required" });
    expect(isCompleteConfig("openai", { pixelId: "1345349876", aamDisabled: true })).toBe(true);
    expect(isCompleteConfig("openai", { pixelId: "x", aamDisabled: true })).toBe(false);
  });

  it("oppref معرّف نقر: مع موافقة الإعلانات وحدها", () => {
    const read = (name: string) => (name === "oppref" ? "oppref_abc" : null);
    expect(touchFromQuery(read, 1)).toBeNull();
    expect(touchFromQuery(read, 1, { clickIds: true })).toEqual({
      values: { oppref: "oppref_abc" },
      at: 1,
    });
  });

  it("الحدث أقدم من 167 ساعة لا يُرسل: هامش ساعة تحت حد OpenAI (7 أيام)", () => {
    const now = new Date("2026-11-28T00:00:00Z");
    expect(isTooOld("openai", new Date("2026-11-21T01:00:00Z"), now)).toBe(false);
    expect(isTooOld("openai", new Date("2026-11-21T00:59:00Z"), now)).toBe(true);
  });

  it("كوكي __oppref: أي محارف ظاهرة حتى 512، بلا محارف تحكم", () => {
    expect(opprefCookie("op/pref+abc=~é")).toBe("op/pref+abc=~é");
    expect(opprefCookie(undefined)).toBeNull();
    expect(opprefCookie("")).toBeNull();
    expect(opprefCookie("a\u0000b")).toBeNull();
    expect(opprefCookie("a\nb")).toBeNull();
    expect(opprefCookie("x".repeat(513))).toBeNull();
    expect(opprefCookie("x".repeat(512))).toHaveLength(512);
  });

  it("بلا تأكيد إطفاء المطابقة المتقدمة الآلية لا يكتمل الإعداد", () => {
    expect(isCompleteConfig("openai", { pixelId: "1345349876", aamDisabled: false })).toBe(false);
    expect(requiresAamConfirmation("openai")).toBe(true);
    expect(requiresAamConfirmation("meta")).toBe(false);
  });
});
