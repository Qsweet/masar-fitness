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
  function attr(response: Awaited<ReturnType<typeof proxy>>): string {
    return decodeURIComponent(response.cookies.get("masar_attr")?.value ?? "");
  }

  it("قبل موافقة الإعلانات: الحملة وصفحة الهبوط وحدهما، ولا معرّف نقر", async () => {
    const response = await proxy(
      new NextRequest("https://example.com/memberships?gclid=Cj0KCQ_abc&utm_source=google"),
    );
    const cookie = response.cookies.get("masar_attr");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(attr(response)).toContain('"utm_source":"google"');
    expect(attr(response)).toContain('"landing":"/memberships"');
    expect(attr(response)).not.toContain("gclid");
    const clickOnly = await proxy(new NextRequest("https://example.com/?fbclid=IwAR2F4"));
    expect(clickOnly.cookies.get("masar_attr")).toBeUndefined();
  });

  it("مع موافقة الإعلانات: معرّفات النقر، وأول لمسة تبقى مع وصول جديد", async () => {
    const consented = (url: string, previous?: string) => {
      const request = new NextRequest(url);
      request.cookies.set("masar_consent", "v1.a0.m1.1800000000");
      if (previous !== undefined) {
        request.cookies.set("masar_attr", previous);
      }
      return proxy(request);
    };
    const first = await consented("https://example.com/?fbclid=IwAR2F4");
    const second = await consented(
      "https://example.com/?ttclid=E.C.P.abc",
      first.cookies.get("masar_attr")?.value,
    );
    const parsed = JSON.parse(attr(second)) as {
      first: { values: object };
      last: { values: object };
    };
    expect(parsed.first.values).toEqual({ fbclid: "IwAR2F4" });
    expect(parsed.last.values).toEqual({ ttclid: "E.C.P.abc" });
    // oppref لإعلانات ChatGPT (القرار 91) معرّف نقر كغيره: بالموافقة وحدها
    const openai = await consented("https://example.com/?oppref=oppref_abc");
    expect(attr(openai)).toContain('"oppref":"oppref_abc"');
    const denied = await proxy(new NextRequest("https://example.com/?oppref=oppref_abc"));
    expect(denied.cookies.get("masar_attr")).toBeUndefined();
  });

  it("اللوحة لا تكتبه", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    const response = await proxy(new NextRequest("https://example.com/admin/login?gclid=abc"));
    expect(response.cookies.get("masar_attr")).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
