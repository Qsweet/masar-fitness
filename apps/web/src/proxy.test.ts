import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

/** لا قاعدة في اختبار الوحدة: لا منصة مفعّلة، فالسياسة كما هي بلا توسعة. */
vi.mock("./server/tracking/site-config", () => ({
  siteTracking: () => Promise.resolve({ providers: [] }),
  enabledProviders: () => [],
  TRACKING_HEADER: "x-masar-tracking",
}));

async function run(path = "/"): Promise<Headers> {
  return (await proxy(new NextRequest(`https://example.com${path}`))).headers;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("يغلق الفهرسة ما لم يُفتح الإعداد صراحةً", async () => {
    vi.stubEnv("SITE_INDEXABLE", "");
    expect((await run()).get("x-robots-tag")).toBe("noindex, nofollow");
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect((await run()).get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("يفتح الفهرسة بالقيمة true فقط (مسار الإنتاج على النطاق الرسمي)", async () => {
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect((await run()).get("x-robots-tag")).toBeNull();
  });

  it("سياسة أمان المحتوى حاضرة في الحالتين وبـnonce جديد لكل طلب", async () => {
    for (const value of ["true", "false"]) {
      vi.stubEnv("SITE_INDEXABLE", value);
      const first = (await run()).get("content-security-policy") ?? "";
      const second = (await run()).get("content-security-policy") ?? "";
      expect(first).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(first).not.toBe(second);
    }
  });
});

describe("كوكي المعاينة", () => {
  async function withCookie(name: string): Promise<Headers> {
    const request = new NextRequest("https://example.com/");
    request.cookies.set(name, "anything");
    return (await proxy(request)).headers;
  }

  it("وجوده (صحيحًا أو لا) يمنع التخزين والفهرسة ولو فُتحت الفهرسة", async () => {
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const name of ["__Host-masar_preview", "masar_preview"]) {
      const headers = await withCookie(name);
      expect(headers.get("cache-control")).toBe("private, no-store");
      expect(headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    expect((await run()).get("cache-control")).toBeNull();
    expect((await run()).get("x-robots-tag")).toBeNull();
  });

  it("سياسة أمان المحتوى بالشكل نفسه معه وبدونه (عدا nonce)", async () => {
    const strip = (csp: string | null) => (csp ?? "").replace(/'nonce-[^']+'/g, "'nonce'");
    expect(strip((await withCookie("masar_preview")).get("content-security-policy"))).toBe(
      strip((await run()).get("content-security-policy")),
    );
  });
});

describe("الروابط الفاسدة", () => {
  it("ترميز نسبة مئوية لا يُفك ⇒ 400 بلا معالجة", async () => {
    const response = await proxy(new NextRequest("https://example.com/memberships/%E0%A4%A"));
    expect(response.status).toBe(400);
  });

  it("الروابط العربية المرمَّزة سليمة وتمر", async () => {
    const response = await proxy(
      new NextRequest("https://example.com/%D8%A7%D9%84%D8%A8%D8%A7%D9%82%D8%A7%D8%AA"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });
});

describe("matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0] ?? ""}$`);

  it.each([
    "/",
    "/en",
    "/memberships/one-year",
    "/blog/v1.2",
    "/memberships/x.png",
    "/page.txt",
    "/robots.txt",
  ])("يشمل الصفحة %s حتى لو انتهى رابطها بامتداد", (path) => {
    expect(pattern.test(path)).toBe(true);
  });

  it.each(["/api/health", "/_next/static/chunk.js", "/_next/image"])("يستثني %s", (path) => {
    expect(pattern.test(path)).toBe(false);
  });
});

describe("لوحة التحكم في الوسيط", () => {
  const KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
  /** الترويسة الداخلية كما يحملها Next إلى الطلب المُمرَّر (تجاوز ترويسات الطلب). */
  const OPEN_MARK = "x-middleware-request-x-masar-admin-open";

  function respond(path: string, headers: Record<string, string> = {}) {
    return proxy(new NextRequest(`https://example.com${path}`, { headers }));
  }

  function forwardedNames(response: Awaited<ReturnType<typeof respond>>): string[] {
    return (response.headers.get("x-middleware-override-headers") ?? "").split(",");
  }

  it("بلا مفتاح: لا علامة فتح ولا إعادة كتابة من الوسيط ولا ترويسة تميّز الرد", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", "");
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const path of ["/admin", "/admin/login", "/admin/staff/abc"]) {
      const response = await respond(path);
      const unknown = await respond("/no-such-page");
      expect(response.headers.get(OPEN_MARK)).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect([...response.headers.keys()].sort()).toEqual([...unknown.headers.keys()].sort());
    }
  });

  it("علامة الفتح التي يرسلها العميل تُحذف دائمًا", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", "");
    const spoofed = await respond("/admin/login", { "x-masar-admin-open": "1" });
    expect(spoofed.headers.get(OPEN_MARK)).toBeNull();
    expect(forwardedNames(spoofed)).not.toContain("x-masar-admin-open");
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    const outside = await respond("/memberships", { "x-masar-admin-open": "1" });
    expect(forwardedNames(outside)).not.toContain("x-masar-admin-open");
  });

  it("بالمفتاح: يُعلَّم الطلب، ولا يُفهرس الرد ولا يُخزَّن حتى على النطاق المفهرس", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const path of ["/admin", "/admin/login", "/admin/audit"]) {
      const response = await respond(path);
      expect(response.headers.get(OPEN_MARK)).toBe("1");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-security-policy")).toMatch(/script-src 'self' 'nonce-/);
    }
  });

  it("كتابة أخرى لاسم اللوحة أو مسار يشبهها: لا علامة فتح ولو كانت اللوحة مفتوحة", async () => {
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const path of ["/Admin/login", "/%61dmin/login", "/administrator", "/en/admin"]) {
      const response = await respond(path);
      expect(response.headers.get(OPEN_MARK)).toBeNull();
      expect(response.headers.get("cache-control")).toBeNull();
    }
  });

  it("المطابق يشمل مسارات اللوحة", () => {
    const [pattern = ""] = config.matcher;
    const matcher = new RegExp(`^${pattern}$`);
    expect(matcher.test("/admin")).toBe(true);
    expect(matcher.test("/admin/login")).toBe(true);
  });
});
