import { describe, expect, it, vi } from "vitest";

const env: { SITE_URL: string; ADMIN_SECRET_KEY: Uint8Array | null } = {
  SITE_URL: "https://example.com",
  ADMIN_SECRET_KEY: null,
};
vi.mock("@/server/env", () => ({ getEnv: () => env }));

const { default: robots } = await import("./robots");

describe("robots.txt", () => {
  it("اللوحة مغلقة: لا تُذكر (سطر المنع كان سيعلن وجودها)", () => {
    env.ADMIN_SECRET_KEY = null;
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://example.com/sitemap.xml",
    });
  });

  it("اللوحة مفتوحة: ممنوعة الزحف مع الواجهات", () => {
    env.ADMIN_SECRET_KEY = new Uint8Array(32);
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] });
  });
});
