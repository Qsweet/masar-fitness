import { describe, expect, it } from "vitest";
import { OPEN_POLICIES } from "./open-policies";
import { initialState, nextState, type Transition } from "./state-machine";

type Light = "off" | "on" | "broken";
type Press = "press" | "smash" | "repair";

const TABLE: readonly Transition<Light, Press>[] = [
  { from: "off", event: "press", to: "on" },
  { from: "on", event: "press", to: "off" },
  { from: "on", event: "smash", to: "broken", blockedBy: "freeze_rules" },
];

describe("nextState", () => {
  it("الانتقال الموجود يرجع الحالة التالية", () => {
    expect(nextState("light", TABLE, "off", "press")).toEqual({ ok: true, value: "on" });
  });

  it("ما ليس في الجدول يرجع <machine>.invalid_transition", () => {
    const result = nextState("light", TABLE, "broken", "repair");
    expect(result.ok).toBe(false);
    expect(result.ok ? null : [result.error.code, result.error.reason]).toEqual([
      "conflict",
      "light.invalid_transition",
    ]);
  });

  it("المحجوب يرجع policy.undecided.<policy> لا الحالة التالية", () => {
    const result = nextState("light", TABLE, "on", "smash");
    expect(result.ok ? null : [result.error.code, result.error.reason]).toEqual([
      "conflict",
      "policy.undecided.freeze_rules",
    ]);
  });
});

describe("initialState", () => {
  it("انتقال الإنشاء غير المحجوب يرجع حالته", () => {
    expect(initialState({ event: "press", to: "on" })).toEqual({ ok: true, value: "on" });
  });

  it.each(OPEN_POLICIES)("انتقال الإنشاء المحجوب بـ%s يرجع policy.undecided", (policy) => {
    const result = initialState({ event: "press", to: "on", blockedBy: policy });
    expect(result.ok ? null : result.error.reason).toBe(`policy.undecided.${policy}`);
  });
});
