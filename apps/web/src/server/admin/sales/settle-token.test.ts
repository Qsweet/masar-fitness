import { TEST_ADMIN_KEY } from "@masar/db/test-support";
import { plainDate } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { openSettleToken, sealSettleToken, type SettleTokenPayload } from "./settle-token";

const NOW = new Date("2026-06-15T09:00:00Z");
const MINUTE_MS = 60_000;
const BINDING = {
  key: TEST_ADMIN_KEY,
  staffId: "018f4e2a-0000-7000-8000-000000000001",
  orderId: "018f4e2a-0000-7000-8000-000000000002",
};
const PAYLOAD: SettleTokenPayload = {
  paymentId: "018f4e2a-7b1c-7d3e-9f4a-5b6c7d8e9f01",
  details: {
    method: "bank_transfer",
    externalReference: "TRF-88412",
    receivedOn: plainDate(2026, 6, 14),
    note: "وصلت صباحًا",
  },
  amountMinor: 149_900,
  currency: "SAR",
};

function after(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * MINUTE_MS);
}

describe("رمز تأكيد الدفع اليدوي", () => {
  it("يُفتح بما خُتم فيه تمامًا، ولا يظهر في نصه شيء مما فيه", () => {
    const token = sealSettleToken(BINDING, PAYLOAD, NOW);
    expect(openSettleToken(BINDING, token, after(1))).toEqual(PAYLOAD);
    expect(token).not.toContain("TRF-88412");
    expect(token).not.toContain(PAYLOAD.paymentId);
  });

  it("ملاحظة فارغة تبقى null", () => {
    const payload = { ...PAYLOAD, details: { ...PAYLOAD.details, note: null } };
    const token = sealSettleToken(BINDING, payload, NOW);
    expect(openSettleToken(BINDING, token, NOW)?.details.note).toBeNull();
  });

  it("عمره عشر دقائق يفحصها الخادم، ووقت من المستقبل مرفوض", () => {
    const token = sealSettleToken(BINDING, PAYLOAD, NOW);
    expect(openSettleToken(BINDING, token, new Date(after(10).getTime() - 1))).not.toBeNull();
    expect(openSettleToken(BINDING, token, after(10))).toBeNull();
    expect(openSettleToken(BINDING, token, after(60))).toBeNull();
    expect(openSettleToken(BINDING, token, after(-1))).toBeNull();
  });

  it("رمز موظف لا يفتحه موظف آخر، ورمز طلب لا يُستعمل على طلب آخر", () => {
    const token = sealSettleToken(BINDING, PAYLOAD, NOW);
    const otherStaff = { ...BINDING, staffId: "018f4e2a-0000-7000-8000-0000000000aa" };
    const otherOrder = { ...BINDING, orderId: "018f4e2a-0000-7000-8000-0000000000bb" };
    expect(openSettleToken(otherStaff, token, NOW)).toBeNull();
    expect(openSettleToken(otherOrder, token, NOW)).toBeNull();
  });

  it("مفتاح آخر لا يفتحه", () => {
    const token = sealSettleToken(BINDING, PAYLOAD, NOW);
    const otherKey = { ...BINDING, key: Uint8Array.from({ length: 32 }, () => 7) };
    expect(openSettleToken(otherKey, token, NOW)).toBeNull();
  });

  it("أي تعديل في الرمز يبطله: القيم لا تُغيَّر بين المراجعة والتنفيذ", () => {
    const token = sealSettleToken(BINDING, PAYLOAD, NOW);
    const parts = token.split(".");
    for (let index = 1; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      const flipped = (part.startsWith("A") ? "B" : "A") + part.slice(1);
      const tampered = [...parts.slice(0, index), flipped, ...parts.slice(index + 1)].join(".");
      expect(openSettleToken(BINDING, tampered, NOW)).toBeNull();
    }
    expect(openSettleToken(BINDING, `${token}x`, NOW)).toBeNull();
  });

  it("نص ليس رمزًا، أو فارغ، أو ضخم: null بلا رمي", () => {
    for (const junk of ["", "abc", "v1.a.b.c", "{}", "x".repeat(6_001)]) {
      expect(openSettleToken(BINDING, junk, NOW)).toBeNull();
    }
  });

  it("رمز مختوم بالمفتاح نفسه لغرض آخر لا يُقبل (سياق مختلف)", async () => {
    const { sealSecret } = await import("@masar/db");
    const bytes = new TextEncoder().encode(JSON.stringify({ ...PAYLOAD, issuedAt: NOW.getTime() }));
    const flash = sealSecret(TEST_ADMIN_KEY, bytes, `flash:${BINDING.staffId}`);
    expect(openSettleToken(BINDING, flash, NOW)).toBeNull();
  });
});
