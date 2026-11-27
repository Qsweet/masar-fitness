import { describe, expect, it } from "vitest";
import { domainVariants, expireVendorCookies } from "./vendor-cookies";

const consent = (analytics: boolean, ads: boolean) => ({ analytics, ads, version: 1, at: 1 });

function jar(initial: string) {
  const writes: string[] = [];
  return {
    writes,
    get cookie() {
      return initial;
    },
    set cookie(value: string) {
      writes.push(value);
    },
  };
}

describe("محو كوكيات المنصات عند السحب", () => {
  it("النطاق وآباؤه بلا المستوى الأعلى، ولا شيء لعنوان IP", () => {
    expect(domainVariants("www.masar.example.sa")).toEqual([
      "www.masar.example.sa",
      "masar.example.sa",
      "example.sa",
    ]);
    expect(domainVariants("127.0.0.1")).toEqual([]);
    expect(domainVariants("localhost")).toEqual([]);
  });

  it("سحب الإعلانات يمحو كوكياتها وحدها على كل نطاق، ويبقي التحليلات وكوكياتنا", () => {
    const cookies = jar("_ga=1; _ga_ABC=2; _gcl_au=3; _fbp=4; _ttp=5; _scid=6; masar_consent=v1");
    const names = expireVendorCookies(
      cookies,
      "www.example.com",
      consent(true, true),
      consent(true, false),
    );
    expect(names).toEqual(["_gcl_au", "_fbp", "_ttp", "_scid"]);
    expect(cookies.writes).toContain("_fbp=; Max-Age=0; Path=/");
    expect(cookies.writes).toContain("_fbp=; Max-Age=0; Path=/; Domain=example.com");
    expect(cookies.writes.some((write) => write.startsWith("_ga="))).toBe(false);
    expect(cookies.writes.some((write) => write.startsWith("masar_"))).toBe(false);
  });

  it("سحب التحليلات يمحو _ga و_ga_*، وبلا سحب لا شيء", () => {
    const cookies = jar("_ga=1; _ga_ABC=2; _fbp=4");
    expect(
      expireVendorCookies(cookies, "example.com", consent(true, true), consent(false, true)),
    ).toEqual(["_ga", "_ga_ABC"]);
    expect(
      expireVendorCookies(jar("_ga=1"), "example.com", consent(false, false), consent(true, true)),
    ).toEqual([]);
  });
});
