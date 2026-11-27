import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

/** نادي الموقع فعّل GA4 وميتا: السياسة تتوسع لهما وحدهما، ولصفحات الموقع لا اللوحة. */
vi.mock("./server/tracking/site-config", () => ({
  siteTracking: () => Promise.resolve({ providers: [] }),
  enabledProviders: () => ["ga4", "meta"],
  TRACKING_HEADER: "x-masar-tracking",
}));

const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

function directive(csp: string, name: string): string {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("CSP مع منصات مفعّلة", () => {
  it("connect-src وimg-src بمضيفات GA4 وميتا وحدها، وبلا frame-src", async () => {
    const csp = (await proxy(new NextRequest("https://example.com/"))).headers.get(
      "content-security-policy",
    );
    const connect = directive(csp ?? "", "connect-src");
    expect(connect).toContain("https://*.google-analytics.com");
    expect(connect).toContain("https://www.facebook.com");
    expect(connect).not.toContain("snapchat");
    expect(connect).not.toContain("tiktok");
    expect(directive(csp ?? "", "img-src")).toContain("https://www.facebook.com");
    expect(csp).not.toContain("frame-src");
    expect(directive(csp ?? "", "script-src")).toMatch(
      /^script-src 'self' 'nonce-[^']+' 'strict-dynamic'$/,
    );
  });

  it("اللوحة بلا توسعة", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    const csp = (await proxy(new NextRequest("https://example.com/admin/login"))).headers.get(
      "content-security-policy",
    );
    expect(csp).not.toMatch(/https:/);
    vi.unstubAllEnvs();
  });
});

describe("كوكي الإسناد", () => {
  it("رابط بمعرّف نقر يكتب masar_attr، ورابط بلا معامل لا يكتب شيئًا", async () => {
    const response = await proxy(
      new NextRequest("https://example.com/memberships?gclid=Cj0KCQ_abc&utm_source=google"),
    );
    const cookie = response.cookies.get("masar_attr");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(decodeURIComponent(cookie?.value ?? "")).toContain('"gclid":"Cj0KCQ_abc"');
    const plain = await proxy(new NextRequest("https://example.com/memberships"));
    expect(plain.cookies.get("masar_attr")).toBeUndefined();
  });

  it("أول لمسة تبقى مع وصول جديد", async () => {
    const first = await proxy(new NextRequest("https://example.com/?fbclid=IwAR2F4"));
    const request = new NextRequest("https://example.com/?ttclid=E.C.P.abc");
    request.cookies.set("masar_attr", first.cookies.get("masar_attr")?.value ?? "");
    const value = decodeURIComponent((await proxy(request)).cookies.get("masar_attr")?.value ?? "");
    const parsed = JSON.parse(value) as { first: { values: object }; last: { values: object } };
    expect(parsed.first.values).toEqual({ fbclid: "IwAR2F4" });
    expect(parsed.last.values).toEqual({ ttclid: "E.C.P.abc" });
  });

  it("اللوحة لا تكتبه", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    const response = await proxy(new NextRequest("https://example.com/admin/login?gclid=abc"));
    expect(response.cookies.get("masar_attr")).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
