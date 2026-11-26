import { hotp, totpStep } from "@masar/domain";
import { describe, expect, it } from "vitest";
import {
  CURRENT_SCRYPT_PARAMS,
  hashPassword,
  hmacSha1,
  issueRecoveryCodes,
  issueSessionToken,
  issueTemporaryPassword,
  needsRehash,
  newTotpSecret,
  normalizeRecoveryCode,
  openSecret,
  RECOVERY_CODE_COUNT,
  recoveryCodeHash,
  sealSecret,
  sessionTokenHash,
  sha256Hex,
  verifyAgainstDummy,
  verifyPassword,
} from "./index";

const FAST = { cost: 1024, blockSize: 8, parallelization: 1 };
const KEY = Uint8Array.from({ length: 32 }, (_, index) => index);
const OTHER_KEY = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const SCRYPT_TIMEOUT_MS = 30_000;

describe("تجزئة كلمة المرور (scrypt)", () => {
  it("المعاملات الحالية كما في المواصفة: N=2^17, r=8, p=1", () => {
    expect(CURRENT_SCRYPT_PARAMS).toEqual({ cost: 131_072, blockSize: 8, parallelization: 1 });
  });

  it(
    "الصيغة تحمل المعاملات وملحًا 16 بايتًا وناتجًا 32 بايتًا، والتحقق بها ينجح",
    async () => {
      const hash = await hashPassword("correct horse battery");
      const [scheme, header, salt = "", key = ""] = hash.split("$");
      expect(scheme).toBe("scrypt");
      expect(header).toBe("N=131072,r=8,p=1");
      expect(Buffer.from(salt, "base64")).toHaveLength(16);
      expect(Buffer.from(key, "base64")).toHaveLength(32);
      expect(await verifyPassword("correct horse battery", hash)).toBe(true);
      expect(await verifyPassword("correct horse batterx", hash)).toBe(false);
      expect(needsRehash(hash)).toBe(false);
    },
    SCRYPT_TIMEOUT_MS,
  );

  it("ملح جديد لكل تجزئة", async () => {
    const [first, second] = await Promise.all([hashPassword("x", FAST), hashPassword("x", FAST)]);
    expect(first).not.toBe(second);
    expect(await verifyPassword("x", first)).toBe(true);
    expect(await verifyPassword("x", second)).toBe(true);
  });

  it("تجزئة بمعاملات أضعف تُقبل وتُعلَّم لإعادة التجزئة", async () => {
    const weak = await hashPassword("old password here", FAST);
    expect(await verifyPassword("old password here", weak)).toBe(true);
    expect(needsRehash(weak)).toBe(true);
  });

  it.each([
    "",
    "plain-text",
    "scrypt$N=1024,r=8,p=1$short$short",
    "scrypt$N=1000,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "scrypt$N=2097152,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "bcrypt$N=1024,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  ])("تجزئة فاسدة «%s» = عدم تطابق بلا استثناء", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
    expect(needsRehash(stored)).toBe(true);
  });

  it(
    "التجزئة الوهمية ترجع false دائمًا وتستهلك تحققًا حقيقيًا",
    async () => {
      expect(await verifyAgainstDummy("any password at all")).toBe(false);
      expect(await verifyAgainstDummy("")).toBe(false);
    },
    SCRYPT_TIMEOUT_MS,
  );
});

describe("صندوق السر (AES-256-GCM)", () => {
  const secret = newTotpSecret();

  it("يفتح ما أغلقه بالمفتاح والسياق نفسيهما", () => {
    const box = sealSecret(KEY, secret, "staff-1");
    expect(box.startsWith("v1.")).toBe(true);
    expect(openSecret(KEY, box, "staff-1")).toEqual(secret);
  });

  it("IV جديد لكل تشفير", () => {
    expect(sealSecret(KEY, secret, "staff-1")).not.toBe(sealSecret(KEY, secret, "staff-1"));
  });

  it("مفتاح آخر أو موظف آخر أو نص معبوث به = null", () => {
    const box = sealSecret(KEY, secret, "staff-1");
    expect(openSecret(OTHER_KEY, box, "staff-1")).toBeNull();
    expect(openSecret(KEY, box, "staff-2")).toBeNull();
    const [version, iv, tag, body = ""] = box.split(".");
    const flipped = body.startsWith("A") ? `B${body.slice(1)}` : `A${body.slice(1)}`;
    expect(openSecret(KEY, [version, iv, tag, flipped].join("."), "staff-1")).toBeNull();
    expect(openSecret(KEY, "v2.a.b.c", "staff-1")).toBeNull();
    expect(openSecret(KEY, "garbage", "staff-1")).toBeNull();
  });

  it("يرفض مفتاحًا ليس 32 بايتًا", () => {
    expect(() => sealSecret(KEY.slice(1), secret, "x")).toThrow("secret_box.invalid_key_length");
    expect(() => openSecret(KEY.slice(1), "v1.a.b.c", "x")).toThrow(
      "secret_box.invalid_key_length",
    );
  });
});

describe("الرموز", () => {
  it("رمز الجلسة 32 بايتًا عشوائيًا، ويُخزَّن مجزأً SHA-256", () => {
    const first = issueSessionToken();
    const second = issueSessionToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(sha256Hex(first.token));
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionTokenHash(first.token)).toBe(first.tokenHash);
  });

  it("قيمة ليست بشكل رمز لا تُجزَّأ", () => {
    expect(sessionTokenHash("")).toBeNull();
    expect(sessionTokenHash("short")).toBeNull();
    expect(sessionTokenHash(`${"a".repeat(42)}!`)).toBeNull();
  });

  it("عشرة رموز استرجاع مختلفة بتجزئاتها", () => {
    const { codes, hashes } = issueRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const [index, code] of codes.entries()) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
      const normalized = normalizeRecoveryCode(code);
      expect(normalized).not.toBeNull();
      expect(recoveryCodeHash(normalized ?? "")).toBe(hashes[index]);
    }
  });

  it("كلمة المرور المؤقتة 20 محرفًا عشوائيًا في أربع مجموعات", () => {
    const password = issueTemporaryPassword();
    expect(password).toMatch(/^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
    expect(issueTemporaryPassword()).not.toBe(password);
  });

  it("رمز الاسترجاع يُقبل بحروف صغيرة ومسافات، ويُرفض ما ليس بشكله", () => {
    expect(normalizeRecoveryCode("abcd efgh-jklm  npqr")).toBe("ABCDEFGHJKLMNPQR");
    expect(normalizeRecoveryCode("ABCD-EFGH-JKLM")).toBeNull();
    expect(normalizeRecoveryCode("ABCD-EFGH-JKLM-NPQ0")).toBeNull();
    expect(normalizeRecoveryCode("")).toBeNull();
  });
});

describe("HMAC-SHA1 من node:crypto مع TOTP المجال", () => {
  const rfcKey = new TextEncoder().encode("12345678901234567890");

  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [20000000000, "65353130"],
  ])("متجه RFC 6238 عند الثانية %i", (seconds, expected) => {
    expect(hotp(hmacSha1, rfcKey, totpStep(seconds * 1000), 8)).toBe(expected);
  });

  it("سر TOTP الجديد 20 بايتًا عشوائيًا", () => {
    expect(newTotpSecret()).toHaveLength(20);
    expect(newTotpSecret()).not.toEqual(newTotpSecret());
  });
});
