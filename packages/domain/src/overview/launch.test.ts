import { describe, expect, it } from "vitest";
import { launchChecklist, launchSummary, type LaunchInput } from "./launch";

const READY: LaunchInput = {
  mfa: { active: 3, enrolled: 3 },
  sellablePlans: 3,
  salesSettings: { windowDecided: true, startDecided: true },
  publishedRelease: true,
  liveSlides: 2,
  backup: { state: "fresh", failing: false },
  payments: "test",
  checkout: "preview",
};

function states(input: LaunchInput): Record<string, string> {
  return Object.fromEntries(launchChecklist(input).map((entry) => [entry.item, entry.state]));
}

describe("launchChecklist: كل بند من حالته الحقيقية", () => {
  it("نادٍ جاهز: كل ما بيد الفريق مكتمل، والدفع الحي لاحقًا، والفتح قرار المالك", () => {
    expect(states(READY)).toEqual({
      mfa: "done",
      plans: "done",
      salesSettings: "done",
      content: "done",
      slider: "done",
      backup: "done",
      payments: "later",
      checkout: "owner",
    });
  });

  it("نادٍ جديد: كل شيء فعل مطلوب", () => {
    const fresh: LaunchInput = {
      mfa: { active: 1, enrolled: 0 },
      sellablePlans: 0,
      salesSettings: { windowDecided: false, startDecided: false },
      publishedRelease: false,
      liveSlides: 0,
      backup: { state: "unmonitored", failing: false },
      payments: "off",
      checkout: "closed",
    };
    expect(states(fresh)).toMatchObject({
      mfa: "todo",
      plans: "todo",
      salesSettings: "todo",
      content: "todo",
      slider: "todo",
      backup: "todo",
    });
  });

  it("كل بند يتغير بحالته وحدها", () => {
    expect(states({ ...READY, mfa: { active: 3, enrolled: 2 } }).mfa).toBe("todo");
    expect(states({ ...READY, mfa: { active: 0, enrolled: 0 } }).mfa).toBe("todo");
    expect(
      states({ ...READY, salesSettings: { windowDecided: true, startDecided: false } })
        .salesSettings,
    ).toBe("todo");
    expect(states({ ...READY, liveSlides: 0 }).slider).toBe("todo");
    expect(states({ ...READY, publishedRelease: false }).content).toBe("todo");
    expect(states({ ...READY, sellablePlans: 0 }).plans).toBe("todo");
    expect(states({ ...READY, payments: "live" }).payments).toBe("done");
    expect(states({ ...READY, checkout: "open" }).checkout).toBe("done");
    expect(states({ ...READY, checkout: "closed" }).checkout).toBe("owner");
  });

  it.each([
    [{ state: "stale", failing: false }, "warn"],
    [{ state: "never", failing: false }, "warn"],
    [{ state: "unreadable", failing: false }, "warn"],
    [{ state: "fresh", failing: true }, "warn"],
    [{ state: "unmonitored", failing: false }, "todo"],
  ] as const)("النسخ الاحتياطي %o ⇒ %s", (backup, expected) => {
    expect(states({ ...READY, backup }).backup).toBe(expected);
  });
});

describe("launchSummary", () => {
  it("المفتوح أولًا والتحذير قبل الفعل، والانتظار والمكتمل منفصلان", () => {
    const summary = launchSummary(
      launchChecklist({
        ...READY,
        sellablePlans: 0,
        backup: { state: "stale", failing: false },
      }),
    );
    expect(summary.open.map((entry) => entry.item)).toEqual(["backup", "plans"]);
    expect(summary.waiting.map((entry) => entry.item)).toEqual(["payments", "checkout"]);
    expect(summary).toMatchObject({ done: 4, total: 8, settled: false });
  });

  it("مكتمل حين لا فعل ولا تحذير باقٍ، ولو بقي قرار المالك", () => {
    expect(launchSummary(launchChecklist(READY))).toMatchObject({
      done: 6,
      total: 8,
      settled: true,
    });
  });

  it("الملخص على البنود الظاهرة للموظف فقط", () => {
    const visible = launchChecklist(READY).filter((entry) => entry.item !== "mfa");
    expect(launchSummary(visible)).toMatchObject({ done: 5, total: 7 });
  });
});
