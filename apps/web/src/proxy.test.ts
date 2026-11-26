import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

function run(path = "/"): Headers {
  return proxy(new NextRequest(`https://example.com${path}`)).headers;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy", () => {
  it("يغلق الفهرسة ما لم يُفتح الإعداد صراحةً", () => {
    vi.stubEnv("SITE_INDEXABLE", "");
    expect(run().get("x-robots-tag")).toBe("noindex, nofollow");
    vi.stubEnv("SITE_INDEXABLE", "false");
    expect(run().get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("يفتح الفهرسة بالقيمة true فقط (مسار الإنتاج على النطاق الرسمي)", () => {
    vi.stubEnv("SITE_INDEXABLE", "true");
    expect(run().get("x-robots-tag")).toBeNull();
  });

  it("سياسة أمان المحتوى حاضرة في الحالتين وبـnonce جديد لكل طلب", () => {
    for (const value of ["true", "false"]) {
      vi.stubEnv("SITE_INDEXABLE", value);
      const first = run().get("content-security-policy") ?? "";
      const second = run().get("content-security-policy") ?? "";
      expect(first).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(first).not.toBe(second);
    }
  });
});

describe("الروابط الفاسدة", () => {
  it("ترميز نسبة مئوية لا يُفك ⇒ 400 بلا معالجة", () => {
    const response = proxy(new NextRequest("https://example.com/memberships/%E0%A4%A"));
    expect(response.status).toBe(400);
  });

  it("الروابط العربية المرمَّزة سليمة وتمر", () => {
    const response = proxy(
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

  function respond(path: string) {
    return proxy(new NextRequest(`https://example.com${path}`));
  }

  it("بلا مفتاح: كل مسار لوحة يُخدَّم من صفحة «غير موجودة» العامة، بلا ترويسة تميّزه", () => {
    vi.stubEnv("ADMIN_SECRET_KEY", "");
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const path of ["/admin", "/admin/login", "/admin/staff/abc"]) {
      const response = respond(path);
      expect(response.headers.get("x-middleware-rewrite")).toBe("https://example.com/admin-closed");
      expect(response.headers.get("x-robots-tag")).toBeNull();
      expect(response.headers.get("cache-control")).toBeNull();
      expect(response.headers.get("content-security-policy")).toBeTruthy();
    }
  });

  it("بالمفتاح: تمر، ولا تُفهرس ولا تُخزَّن حتى على النطاق المفهرس", () => {
    vi.stubEnv("ADMIN_SECRET_KEY", KEY);
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const path of ["/admin", "/admin/login", "/admin/audit"]) {
      const response = respond(path);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-security-policy")).toMatch(/script-src 'self' 'nonce-/);
    }
  });

  it("مسار يشبه اللوحة ليس منها: لا إعادة كتابة ولا منع تخزين", () => {
    vi.stubEnv("ADMIN_SECRET_KEY", "");
    vi.stubEnv("SITE_INDEXABLE", "true");
    for (const path of ["/administrator", "/en/admin", "/blog/admin"]) {
      const response = respond(path);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
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
