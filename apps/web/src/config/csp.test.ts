import { describe, expect, it } from "vitest";
import { buildCsp, paymentFormActionOrigins } from "./csp";
import { trackingCsp } from "./tracking-csp";

describe("buildCsp", () => {
  const production = buildCsp("abc123", false);

  it("السكربتات بالـnonce فقط: لا unsafe-inline ولا eval في الإنتاج", () => {
    const scriptSrc = production
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it("eval في وضع التطوير فقط", () => {
    expect(buildCsp("abc123", true)).toContain("'unsafe-eval'");
    expect(production).not.toContain("unsafe-eval");
  });

  it("يمنع التأطير والإضافات وتغيير الأصل ووجهات النماذج الخارجية", () => {
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(production.split("; ")).toContain(directive);
    }
  });

  it("لا مصدر خارجي في أي توجيه", () => {
    expect(production).not.toMatch(/https?:|\*/);
  });
});

describe("form-action وصفحة الدفع المستضافة", () => {
  const moyasar = {
    PAYMENTS_MODE: "test",
    PAYMENTS_PROVIDER: "moyasar",
    MOYASAR_HOSTED_PAGE_ORIGIN: "https://pay.example",
  };

  function formAction(env: Record<string, string | undefined>): string | undefined {
    return buildCsp("abc123", false, paymentFormActionOrigins(env))
      .split("; ")
      .find((directive) => directive.startsWith("form-action"));
  }

  it("مع Moyasar وأصل معلن: الأصل يضاف إلى form-action وحده", () => {
    expect(formAction(moyasar)).toBe("form-action 'self' https://pay.example");
    expect(buildCsp("abc123", false, ["https://pay.example"])).toContain("connect-src 'self';");
  });

  it.each([
    ["بلا إعداد دفع", {}],
    ["الدفع مغلق", { ...moyasar, PAYMENTS_MODE: "off" }],
    ["مزوّد الاختبار", { ...moyasar, PAYMENTS_PROVIDER: "fake" }],
    ["بلا أصل معلن", { ...moyasar, MOYASAR_HOSTED_PAGE_ORIGIN: undefined }],
    ["أصل http", { ...moyasar, MOYASAR_HOSTED_PAGE_ORIGIN: "http://pay.example" }],
    ["أصل بمسار", { ...moyasar, MOYASAR_HOSTED_PAGE_ORIGIN: "https://pay.example/x" }],
    ["حقن توجيه", { ...moyasar, MOYASAR_HOSTED_PAGE_ORIGIN: "https://a.example; script-src *" }],
    ["نجمة", { ...moyasar, MOYASAR_HOSTED_PAGE_ORIGIN: "*" }],
  ])("%s: form-action يبقى 'self'", (_name, env) => {
    expect(formAction(env)).toBe("form-action 'self'");
  });
});

describe("منصات القياس في CSP", () => {
  it("بلا منصة لا تتغير السياسة حرفًا", () => {
    expect(buildCsp("n", false, [], trackingCsp([]))).toBe(buildCsp("n", false));
  });

  it("كل منصة بمضيفاتها، وframe-src لـGTM وGoogle Ads وحدهما", () => {
    const meta = buildCsp("n", false, [], trackingCsp(["meta"]));
    expect(meta).toContain(
      "connect-src 'self' https://connect.facebook.net https://www.facebook.com",
    );
    expect(meta).not.toContain("frame-src");
    const ads = buildCsp("n", false, [], trackingCsp(["google_ads", "gtm"]));
    expect(ads).toContain("frame-src 'self' https://www.googletagmanager.com");
    expect(ads).toContain("https://www.google.com.sa");
    expect(trackingCsp(["snap"]).connect).toEqual(["https://tr.snapchat.com"]);
    expect(trackingCsp(["tiktok"]).img).toEqual(["https://analytics.tiktok.com"]);
  });

  it("لا تكرار بين منصات تشترك في مضيف", () => {
    const { connect } = trackingCsp(["gtm", "ga4", "google_ads"]);
    expect(connect.filter((host) => host === "https://www.googletagmanager.com")).toHaveLength(1);
  });
});
