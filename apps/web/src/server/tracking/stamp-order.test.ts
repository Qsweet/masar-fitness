import { describe, expect, it } from "vitest";
import { adIdentifiersFor, touchFor } from "./stamp-order";

describe("اللمسة المختومة مع الطلب", () => {
  const touch = { values: { utm_source: "snap", ScCid: "7b3a" }, at: 1, landing: "/" };

  it("بلا موافقة الإعلانات: الحملة وحدها، ومعها كما هي", () => {
    expect(touchFor(touch, false)).toEqual({ values: { utm_source: "snap" }, at: 1, landing: "/" });
    expect(touchFor(touch, true)).toEqual(touch);
    expect(touchFor({ values: { gclid: "x1" }, at: 1 }, false)).toBeNull();
    expect(touchFor(undefined, true)).toBeNull();
  });
});

describe("كوكيات OpenAI مع الطلب (مراجعة القرار 93، L1)", () => {
  const cookies: Record<string, string> = {
    __oppref: "op/pref+cookie=",
    __obref: "123e4567-e89b-42d3-a456-426614174000",
  };
  const read = (name: string) => cookies[name];

  it("بموافقة الإعلانات: __oppref كما هو و__obref؛ وبلاها لا شيء", () => {
    expect(adIdentifiersFor(true, read, new Headers())).toMatchObject({
      oppref: "op/pref+cookie=",
      obref: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(adIdentifiersFor(false, read, new Headers())).toMatchObject({
      oppref: null,
      obref: null,
    });
  });

  it("__oppref بمحرف تحكم أو فوق 512 لا يُختم", () => {
    const bad = (value: string) => adIdentifiersFor(true, () => value, new Headers()).oppref;
    expect(bad("a\u0007b")).toBeNull();
    expect(bad("x".repeat(513))).toBeNull();
  });
});
