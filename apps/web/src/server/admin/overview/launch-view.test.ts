import { launchChecklist, type LaunchInput } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { launchCounts } from "./launch-view";

const FRESH: LaunchInput = {
  mfa: { active: 2, enrolled: 1 },
  sellablePlans: 0,
  salesSettings: { windowDecided: true, startDecided: true },
  publishedRelease: false,
  liveSlides: 0,
  backup: { state: "unmonitored", failing: false },
  payments: "test",
  checkout: "preview",
};

describe("ملخص قائمة الإطلاق: على البنود كلها، والدور يقسم المفتوح بين «بيدك» و«بيد المالك»", () => {
  const entries = launchChecklist(FRESH);

  it("المالك: كل المفتوح بيده", () => {
    const owner = launchCounts({
      entries,
      actionable: entries.map((e) => e.item),
      payments: "test",
    });
    expect(owner).toMatchObject({ done: 1, total: 8, mine: 5, owner: 0, settled: false });
    expect(owner.waiting.map((entry) => entry.item)).toEqual(["payments", "checkout"]);
  });

  it("المدير: الأرقام نفسها، والخطوتان وإعدادات البيع بيد المالك لا «اكتمل»", () => {
    const manager = launchCounts({
      entries,
      actionable: ["plans", "content", "slider", "backup", "payments", "checkout"],
      payments: "test",
    });
    expect(manager).toMatchObject({ done: 1, total: 8, mine: 4, owner: 1, settled: false });
  });
});
