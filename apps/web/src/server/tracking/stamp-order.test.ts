import { describe, expect, it } from "vitest";
import { touchFor } from "./stamp-order";

describe("اللمسة المختومة مع الطلب", () => {
  const touch = { values: { utm_source: "snap", ScCid: "7b3a" }, at: 1, landing: "/" };

  it("بلا موافقة الإعلانات: الحملة وحدها، ومعها كما هي", () => {
    expect(touchFor(touch, false)).toEqual({ values: { utm_source: "snap" }, at: 1, landing: "/" });
    expect(touchFor(touch, true)).toEqual(touch);
    expect(touchFor({ values: { gclid: "x1" }, at: 1 }, false)).toBeNull();
    expect(touchFor(undefined, true)).toBeNull();
  });
});
