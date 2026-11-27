import { describe, expect, it } from "vitest";
import { transportChoice } from "./transport-choice";

describe("ناقل أمر المرسِل", () => {
  it("fake على عنوان الجهاز وحده، وقيمة أخرى مرفوضة", () => {
    expect(transportChoice("fake", "http://127.0.0.1:3100")).toEqual({ ok: true, value: "fake" });
    expect(transportChoice("live", "https://example.com")).toEqual({ ok: true, value: "live" });
    expect(transportChoice("fake", "https://example.com").ok).toBe(false);
    expect(transportChoice("maybe", "http://127.0.0.1").ok).toBe(false);
  });
});
