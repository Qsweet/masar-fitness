import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({ getEnv: () => ({ SITE_URL: "https://example.com" }) }));

const { default: robots } = await import("./robots");

describe("robots.txt", () => {
  it("يمنع زحف الواجهات ولوحة التحكم، ويسمح بغيرهما", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
      sitemap: "https://example.com/sitemap.xml",
    });
  });
});
