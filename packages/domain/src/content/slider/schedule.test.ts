import { describe, expect, it } from "vitest";
import { densePositions, isMoveDirection, moveSlide } from "./order";
import { liveSlides, parseSchedule, slideStatus } from "./schedule";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-12-01T09:00:00.000Z");

describe("slideStatus", () => {
  it("المخفية أولًا ولو سرت جدولتها", () => {
    expect(slideStatus({ active: false, startsAt: null, endsAt: null }, NOW)).toBe("hidden");
  });

  it("البداية شاملة والنهاية غير شاملة", () => {
    const slide = { active: true, startsAt: NOW, endsAt: at("2026-12-02T09:00:00.000Z") };
    expect(slideStatus(slide, at("2026-12-01T08:59:59.999Z"))).toBe("scheduled");
    expect(slideStatus(slide, NOW)).toBe("live");
    expect(slideStatus(slide, at("2026-12-02T08:59:59.999Z"))).toBe("live");
    expect(slideStatus(slide, at("2026-12-02T09:00:00.000Z"))).toBe("expired");
  });

  it("بلا جدولة سارية دائمًا", () => {
    expect(slideStatus({ active: true, startsAt: null, endsAt: null }, NOW)).toBe("live");
  });

  it("liveSlides تبقي الترتيب وتحذف غير السارية", () => {
    const slides = [
      { id: "a", active: true, startsAt: null, endsAt: null },
      { id: "b", active: false, startsAt: null, endsAt: null },
      { id: "c", active: true, startsAt: at("2027-01-01T00:00:00.000Z"), endsAt: null },
      { id: "d", active: true, startsAt: null, endsAt: at("2027-01-01T00:00:00.000Z") },
    ];
    expect(liveSlides(slides, NOW).map((slide) => slide.id)).toEqual(["a", "d"]);
  });
});

describe("parseSchedule", () => {
  it("يقرأ الوقت بتوقيت الرياض (UTC+3)", () => {
    expect(parseSchedule({ startsAt: "2026-12-01T12:00", endsAt: "" }, "Asia/Riyadh")).toEqual({
      ok: true,
      value: { startsAt: NOW, endsAt: null },
    });
  });

  it("النهاية قبل البداية أو تساويها مرفوضة، والصيغة الخاطئة بحقلها", () => {
    expect(
      parseSchedule({ startsAt: "2026-12-01T12:00", endsAt: "2026-12-01T12:00" }, "Asia/Riyadh"),
    ).toEqual({ ok: false, error: { field: "endsAt", reason: "slider.schedule_order" } });
    expect(parseSchedule({ startsAt: "غدًا", endsAt: "" }, "Asia/Riyadh")).toEqual({
      ok: false,
      error: { field: "startsAt", reason: "slider.schedule_invalid" },
    });
  });
});

describe("moveSlide", () => {
  const ids = ["a", "b", "c"];

  it("يبدّل الشريحة مع جارتها", () => {
    expect(moveSlide(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveSlide(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("على الحافة أو مجهولة: لا تغيير", () => {
    expect(moveSlide(ids, "a", "up")).toBeNull();
    expect(moveSlide(ids, "c", "down")).toBeNull();
    expect(moveSlide(ids, "z", "up")).toBeNull();
  });

  it("الترتيب الكثيف من الصفر، والاتجاه المجهول مرفوض", () => {
    expect([...densePositions(["x", "y"])]).toEqual([
      ["x", 0],
      ["y", 1],
    ]);
    expect(isMoveDirection("up")).toBe(true);
    expect(isMoveDirection("left")).toBe(false);
  });
});
