import { describe, expect, it } from "vitest";
import { clientIp, UNKNOWN_CLIENT_IP } from "./client-ip";

describe("عنوان العميل لمفتاح الحد", () => {
  it("يأخذ القيمة الأخيرة (ما كتبه الوسيط) لا الأولى التي يختارها العميل", () => {
    expect(clientIp("1.1.1.1, 203.0.113.7")).toBe("203.0.113.7");
    expect(clientIp(" 203.0.113.7 ")).toBe("203.0.113.7");
  });

  it("IPv6 بحروف موحّدة", () => {
    expect(clientIp("2001:DB8::1")).toBe("2001:db8::1");
  });

  it("الغائب أو الفارغ أو غير العنوان يصبح مفتاحًا مشتركًا واحدًا", () => {
    for (const value of [null, "", " , ", "evil<script>", "9".repeat(46)]) {
      expect(clientIp(value)).toBe(UNKNOWN_CLIENT_IP);
    }
  });
});
