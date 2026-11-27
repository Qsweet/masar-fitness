import { describe, expect, it, vi } from "vitest";

/** بدء المعاينة (ADMIN_A3_CONTENT §11، WP5): التحويل إلى المسارات المعروفة وحدها، والهدف لنادي الموظف. */
const findRelease = vi.fn((_db: unknown, clubId: string) =>
  Promise.resolve(clubId === "c1" ? { id: "r" } : null),
);
vi.mock("@masar/db", () => ({ findRelease, openSecret: vi.fn(), sealSecret: vi.fn() }));
vi.mock("../../db", () => ({ getDb: () => ({}) }));
vi.mock("../../env", () => ({ getEnv: () => ({ SITE_URL: "https://example.com" }) }));

const { previewDestination, previewTarget, siteUrl } = await import("./preview-route");
const RELEASE = "018f4e2a-0000-7000-8000-0000000000aa";

function context(clubId: string) {
  return { staff: { id: "s", clubId, role: "editor" } } as unknown as Parameters<
    typeof previewTarget
  >[0];
}

describe("وجهة المعاينة", () => {
  it("المسارات الثابتة المعروفة باللغتين وحدها، وما سواها الرئيسية", () => {
    expect(previewDestination("/memberships", "en")).toBe("/en/memberships");
    expect(previewDestination("/tools/cost-per-visit", "ar")).toBe("/tools/cost-per-visit");
    expect(previewDestination("//evil.example/x", "ar")).toBe("/");
    expect(previewDestination("https://evil.example", "en")).toBe("/en");
    expect(previewDestination("/admin", "fr")).toBe("/");
    expect(previewDestination(null, null)).toBe("/");
    expect(siteUrl(previewDestination("//evil.example", "ar")).origin).toBe("https://example.com");
  });

  it("الهدف: المسودة، أو إصدار لنادي الموظف وحده", async () => {
    expect(await previewTarget(context("c1"), "draft")).toBe("draft");
    expect(await previewTarget(context("c1"), RELEASE)).toBe(RELEASE);
    expect(await previewTarget(context("c2"), RELEASE)).toBeNull();
    expect(await previewTarget(context("c1"), "../x")).toBeNull();
    expect(await previewTarget(context("c1"), null)).toBeNull();
  });
});
