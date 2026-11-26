import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  constantTimeEqual,
  hotp,
  matchTotpStep,
  otpauthUri,
  parseTotpInput,
  totpStep,
} from "./totp";
import { asciiBytes, testHmacSha1 } from "./test-hmac-sha1";

const hmac = testHmacSha1;
/** سر متجهات RFC 6238 (SHA-1): النص ASCII «12345678901234567890». */
const RFC_KEY = asciiBytes("12345678901234567890");
const RFC_DIGITS = 8;
const STEP_MS = 30_000;

describe("TOTP: متجهات RFC 6238 (الملحق B، SHA-1)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("الثانية %i ← %s", (seconds, expected) => {
    const step = totpStep(seconds * 1000);
    expect(hotp(hmac, RFC_KEY, step, RFC_DIGITS)).toBe(expected);
    // رمز الستة أرقام هو آخر ستة من رمز الثمانية (الباقي على قوة العشرة)
    expect(hotp(hmac, RFC_KEY, step)).toBe(expected.slice(-6));
  });
});

describe("HOTP: متجهات RFC 4226 (الملحق D)", () => {
  it.each([
    [0, "755224"],
    [1, "287082"],
    [2, "359152"],
    [9, "520489"],
  ])("العدّاد %i ← %s", (counter, expected) => {
    expect(hotp(hmac, RFC_KEY, counter)).toBe(expected);
  });
});

describe("نافذة القبول ومنع إعادة الرمز", () => {
  const nowMs = 1_800_000_000_000;
  const current = totpStep(nowMs);
  const check = (code: string, lastStep: number | null = null) =>
    matchTotpStep({ hmac, key: RFC_KEY, code, nowMs, lastStep });

  it("يقبل رمز الخطوة الحالية والسابقة والتالية", () => {
    expect(check(hotp(hmac, RFC_KEY, current))).toBe(current);
    expect(check(hotp(hmac, RFC_KEY, current - 1))).toBe(current - 1);
    expect(check(hotp(hmac, RFC_KEY, current + 1))).toBe(current + 1);
  });

  it("يرفض ما خرج عن النافذة", () => {
    expect(check(hotp(hmac, RFC_KEY, current - 2))).toBeNull();
    expect(check(hotp(hmac, RFC_KEY, current + 2))).toBeNull();
  });

  it("الرمز المستعمل لا يُقبل ثانية، ولا رمز خطوة أقدم منه", () => {
    const code = hotp(hmac, RFC_KEY, current);
    expect(check(code, current)).toBeNull();
    expect(check(hotp(hmac, RFC_KEY, current - 1), current)).toBeNull();
    expect(check(hotp(hmac, RFC_KEY, current + 1), current)).toBe(current + 1);
  });

  it("يرفض رمزًا خاطئًا", () => {
    const code = hotp(hmac, RFC_KEY, current);
    const wrong = code === "000000" ? "000001" : "000000";
    expect(check(wrong)).toBeNull();
  });

  it("الخطوة تتغير كل 30 ثانية", () => {
    expect(totpStep(nowMs + STEP_MS)).toBe(current + 1);
    expect(totpStep(current * STEP_MS)).toBe(current);
    expect(totpStep(current * STEP_MS - 1)).toBe(current - 1);
  });
});

describe("إدخال الرمز", () => {
  it("يقبل ستة أرقام ولو بمسافات", () => {
    expect(parseTotpInput(" 123 456 ")).toBe("123456");
  });

  it.each(["", "12345", "1234567", "12345a", "١٢٣٤٥٦"])("يرفض «%s»", (raw) => {
    expect(parseTotpInput(raw)).toBeNull();
  });
});

describe("المقارنة بزمن ثابت", () => {
  it("تطابق النص نفسه فقط", () => {
    expect(constantTimeEqual("123456", "123456")).toBe(true);
    expect(constantTimeEqual("123456", "123457")).toBe(false);
    expect(constantTimeEqual("123456", "12345")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
    expect(constantTimeEqual("a", "")).toBe(false);
  });
});

describe("Base32 (RFC 4648)", () => {
  it.each([
    ["", ""],
    ["f", "MY"],
    ["fo", "MZXQ"],
    ["foo", "MZXW6"],
    ["foob", "MZXW6YQ"],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI"],
  ])("«%s» ← %s", (text, encoded) => {
    const bytes = asciiBytes(text);
    expect(base32Encode(bytes)).toBe(encoded);
    expect(base32Decode(encoded)).toEqual(bytes);
  });

  it("يفك الحروف الصغيرة والمسافات والحشو، ويرفض محرفًا غريبًا", () => {
    expect(base32Decode("mzxw 6ytb oi==")).toEqual(asciiBytes("foobar"));
    expect(base32Decode("MZXW1")).toBeNull();
  });

  it("سر RFC بصيغته المعروفة", () => {
    expect(base32Encode(RFC_KEY)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
});

describe("رابط التسجيل", () => {
  it("يحمل السر والمُصدر والمعاملات", () => {
    const uri = otpauthUri({ issuer: "Masters Way", account: "a@b.sa", secretBase32: "ABC" });
    expect(uri).toBe(
      "otpauth://totp/Masters%20Way:a%40b.sa?secret=ABC&issuer=Masters%20Way&algorithm=SHA1&digits=6&period=30",
    );
  });
});
