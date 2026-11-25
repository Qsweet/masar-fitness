import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { composeMessage } from "./contact-message";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe("composeMessage", () => {
  it("يكتب سطرًا لكل حقل مملوء بنصوص القاموس", () => {
    const text = composeMessage(
      form({ name: " سعد ", interest: "rehab", mobile: "0550000000", message: "متى أبدأ؟" }),
      ar.contact,
    );
    expect(text).toBe(
      ["مرحبًا، أنا سعد.", "أستفسر عن: تأهيل الإصابات.", "جوالي: 0550000000.", "متى أبدأ؟"].join(
        "\n",
      ),
    );
  });

  it("يتجاهل الحقول الفارغة والاهتمام غير المعروف", () => {
    expect(composeMessage(form({ name: "سعد", interest: "toString" }), ar.contact)).toBe(
      "مرحبًا، أنا سعد.",
    );
  });
});
