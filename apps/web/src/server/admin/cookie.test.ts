import { describe, expect, it } from "vitest";
import { adminCookie } from "./cookie";

describe("كوكي جلسة الموظف", () => {
  it("على https: البادئة ‎__Host-‎ مع Secure و HttpOnly و SameSite=Strict و Path=/", () => {
    expect(adminCookie("https://example.com")).toEqual({
      name: "__Host-masar_admin",
      options: { httpOnly: true, secure: true, sameSite: "strict", path: "/" },
    });
  });

  it("على عنوان الجهاز بـhttp: اسم بلا البادئة وبلا Secure (المتصفح يرفضهما بلا https)", () => {
    expect(adminCookie("http://127.0.0.1:3103")).toEqual({
      name: "masar_admin",
      options: { httpOnly: true, secure: false, sameSite: "strict", path: "/" },
    });
  });

  it("بلا Domain في الحالتين (شرط البادئة ‎__Host-‎)", () => {
    expect(Object.keys(adminCookie("https://example.com").options)).not.toContain("domain");
  });
});
