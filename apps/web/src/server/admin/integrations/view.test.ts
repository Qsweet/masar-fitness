import type { IntegrationView } from "@masar/db";
import { describe, expect, it } from "vitest";
import { statusOf } from "./view";

function view(overrides: Partial<IntegrationView>): IntegrationView {
  return {
    provider: "meta",
    enabled: true,
    config: { pixelId: "123456789012345" },
    secretLast4: "abcd",
    testEventCode: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("حالة المنصة في اللوحة", () => {
  it("لم تُحفظ أو إعدادها ناقص: لم تُضبط", () => {
    expect(statusOf("meta", null)).toBe("notConfigured");
    expect(statusOf("meta", view({ config: {} }))).toBe("notConfigured");
  });

  it("متوقفة، ومفعّلة، ومفعّلة بلا مفتاح خادمي", () => {
    expect(statusOf("meta", view({ enabled: false }))).toBe("disabled");
    expect(statusOf("meta", view({}))).toBe("enabled");
    expect(statusOf("meta", view({ secretLast4: null }))).toBe("missingSecret");
  });

  it("منصة متصفح وحده لا تحتاج مفتاحًا", () => {
    expect(
      statusOf(
        "gtm",
        view({ provider: "gtm", config: { containerId: "GTM-AB12CD" }, secretLast4: null }),
      ),
    ).toBe("enabled");
  });
});
