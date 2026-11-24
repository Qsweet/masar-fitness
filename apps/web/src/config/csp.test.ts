import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

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
