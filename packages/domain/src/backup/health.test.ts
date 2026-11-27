import { describe, expect, it } from "vitest";
import { backupAlert, backupHealth, EMPTY_BACKUP_RECORDS, type BackupRecords } from "./health";
import type { BackupRecord } from "./status";

const NOW = new Date("2026-11-28T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

function backup(hours: number, ok = true): BackupRecord {
  return {
    kind: "backup",
    ok,
    finishedAt: hoursAgo(hours),
    snapshot: ok ? "b".repeat(64) : null,
    step: ok ? null : "upload",
    repositoryBytes: ok ? 4096 : null,
  };
}

function records(overrides: Partial<BackupRecords>): BackupRecords {
  return { ...EMPTY_BACKUP_RECORDS, ...overrides };
}

describe("backupHealth: حداثة آخر نسخة ناجحة (الحد 36 ساعة)", () => {
  it("نسخة قبل ساعتين: fresh بعمرها وحجم المستودع، ولا تنبيه", () => {
    const health = backupHealth(records({ lastSuccess: backup(2), lastRun: backup(2) }), NOW);
    expect(health).toMatchObject({
      state: "fresh",
      ageHours: 2,
      lastRunFailed: false,
      repositoryBytes: 4096,
    });
    expect(backupAlert(health, false)).toBeNull();
  });

  it("الحد نفسه: 36 ساعة fresh، وبعده بثانية stale وتنبيه", () => {
    expect(backupHealth(records({ lastSuccess: backup(36) }), NOW).state).toBe("fresh");
    const late = backupHealth(records({ lastSuccess: backup(36 + 1 / 3600) }), NOW);
    expect(late).toMatchObject({ state: "stale", ageHours: 36 });
    expect(backupAlert(late, false)).toBe("stale");
    expect(backupAlert(late, true)).toBe("stale");
  });

  it("فشل الليلة بعد نجاح أمس: يبقى fresh ويُعلَّم الفشل، ثم stale بانقضاء الحد", () => {
    const health = backupHealth(
      records({ lastSuccess: backup(25), lastRun: backup(1, false) }),
      NOW,
    );
    expect(health).toMatchObject({ state: "fresh", lastRunFailed: true });
    expect(backupAlert(health, false)).toBeNull();
    const older = backupHealth(
      records({ lastSuccess: backup(49), lastRun: backup(1, false) }),
      NOW,
    );
    expect(older.state).toBe("stale");
  });

  it("فشل قديم قبل آخر نجاح لا يُعدّ", () => {
    const health = backupHealth(
      records({ lastSuccess: backup(2), lastRun: backup(30, false) }),
      NOW,
    );
    expect(health.lastRunFailed).toBe(false);
  });

  it("محاولات بلا نجاح قط: never وتنبيه ولو أُعلن BACKUP_CONFIGURED", () => {
    const health = backupHealth(records({ lastRun: backup(1, false) }), NOW);
    expect(health).toMatchObject({
      state: "never",
      lastSuccessAt: null,
      ageHours: null,
      lastRunFailed: true,
    });
    expect(backupAlert(health, true)).toBe("never");
  });

  it("لا سجل أصلًا: unmonitored، والتنبيه يتبع BACKUP_CONFIGURED القديم (توافق)", () => {
    const health = backupHealth(EMPTY_BACKUP_RECORDS, NOW);
    expect(health.state).toBe("unmonitored");
    expect(backupAlert(health, false)).toBe("unmonitored");
    expect(backupAlert(health, true)).toBeNull();
  });

  it("ملف لا يُقرأ أو نجاح في المستقبل البعيد: unreadable وتنبيه، بلا وقت نجاح معروض", () => {
    const broken = backupHealth(records({ lastSuccess: backup(2), lastCheck: "unreadable" }), NOW);
    expect(broken).toMatchObject({ state: "unreadable", lastSuccessAt: null });
    expect(backupAlert(broken, true)).toBe("unreadable");
    expect(backupHealth(records({ lastSuccess: backup(-2) }), NOW).state).toBe("unreadable");
    expect(backupHealth(records({ lastSuccess: backup(-0.5) }), NOW)).toMatchObject({
      state: "fresh",
      ageHours: 0,
    });
  });

  it("فحص سلامة فاشل: تنبيه ولو كانت النسخة حديثة", () => {
    const check: BackupRecord = {
      kind: "check",
      ok: false,
      finishedAt: hoursAgo(3),
      snapshot: null,
      step: "check",
      repositoryBytes: null,
    };
    const health = backupHealth(records({ lastSuccess: backup(2), lastCheck: check }), NOW);
    expect(health).toMatchObject({ state: "fresh", checkFailed: true });
    expect(backupAlert(health, false)).toBe("check_failed");
  });

  it("آخر تجربة استرجاع ناجحة تُعرض، والفاشلة لا", () => {
    const drill = (ok: boolean): BackupRecord => ({ ...backup(100), kind: "drill", ok });
    expect(backupHealth(records({ lastDrill: drill(true) }), NOW).lastDrillAt).toEqual(
      hoursAgo(100),
    );
    expect(backupHealth(records({ lastDrill: drill(false) }), NOW).lastDrillAt).toBeNull();
  });
});
