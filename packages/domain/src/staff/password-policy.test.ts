import { describe, expect, it } from "vitest";
import {
  checkPasswordPolicy,
  normalizePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./password-policy";

const CONTEXT = { email: "khalid@example.sa", forbiddenWords: ["Masters Way", "مسار الأبطال"] };

function check(password: string) {
  return checkPasswordPolicy({ ...CONTEXT, password });
}

function reasonOf(password: string): string | null {
  const result = check(password);
  return result.ok ? null : result.error.reason;
}

describe("سياسة كلمة المرور", () => {
  it("تقبل 12 حرفًا بلا قواعد تركيب", () => {
    expect(check("correct horse battery").ok).toBe(true);
    expect(check("tfkxqwplmzrv").ok).toBe(true);
  });

  it("ترفض الأقصر من 12", () => {
    expect(reasonOf("x".repeat(PASSWORD_MIN_LENGTH - 1))).toBe("staff.password_too_short");
    expect(reasonOf("")).toBe("staff.password_too_short");
  });

  it("تقبل 128 وترفض 129", () => {
    const base = "kq7Zp-";
    const long = base.repeat(30).slice(0, PASSWORD_MAX_LENGTH - 1);
    expect(check(`${long}!`).ok).toBe(true);
    expect(reasonOf(`${long}!!`)).toBe("staff.password_too_long");
  });

  it("تعدّ الحرف العربي والرمز التعبيري حرفًا واحدًا", () => {
    expect(check("نخلة وبحر وجبل").ok).toBe(true);
    expect(reasonOf("🙂🙃😉😊😇🥰😍🤩😘😗😚")).toBe("staff.password_too_short");
  });

  it.each(["password1234", "Password1234", "QWERTYUIOP12", "123456789012", "1q2w3e4r5t6y"])(
    "ترفض الشائعة «%s»",
    (password) => {
      expect(reasonOf(password)).toBe("staff.password_common");
    },
  );

  it.each(["aaaaaaaaaaaa", "abababababab", "abcabcabcabc", "abcdabcdabcd", "abcdefghijkl"])(
    "ترفض التكرار والتسلسل «%s»",
    (password) => {
      expect(reasonOf(password)).toBe("staff.password_common");
    },
  );

  it("ترفض ما يحوي البريد أو جزءه المحلي", () => {
    expect(reasonOf("khalid@example.sa!")).toBe("staff.password_contains_identity");
    expect(reasonOf("my-Khalid-2026-x")).toBe("staff.password_contains_identity");
  });

  it("ترفض ما يحوي اسم النادي بأي لغة أو حالة حروف", () => {
    expect(reasonOf("MastersWay-2026")).toBe("staff.password_contains_identity");
    expect(reasonOf("masters way gym!")).toBe("staff.password_contains_identity");
    expect(reasonOf("نادي مسار الأبطال")).toBe("staff.password_contains_identity");
  });

  it("جزء محلي أقصر من أربعة أحرف لا يرفض كلمات بريئة", () => {
    const result = checkPasswordPolicy({
      ...CONTEXT,
      email: "al@example.sa",
      password: "salty-walrus-77",
    });
    expect(result.ok).toBe(true);
  });

  it("ترجع الكلمة موحّدة NFKC، والتوحيد نفسه عند الدخول", () => {
    const composed = "café-table-lamp";
    const decomposed = "café-table-lamp";
    const result = check(decomposed);
    expect(result.ok && result.value).toBe(composed);
    expect(normalizePassword(decomposed)).toBe(composed);
  });
});
