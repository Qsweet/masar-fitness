import { describe, expect, it } from "vitest";
import { parseBackupRecord } from "./status";

const SNAPSHOT = "a".repeat(64);
const success = {
  format: 1,
  kind: "backup",
  ok: true,
  finishedAt: "2026-11-27T03:12:00Z",
  snapshot: SNAPSHOT,
  bytesProcessed: 10,
  bytesAdded: 5,
  repositoryBytes: 2048,
  appVersion: "f796f5b",
};
const text = (value: unknown) => JSON.stringify(value);

describe("parseBackupRecord: شكل ملفات سجل النسخ (docs/BACKUP.md §9)", () => {
  it("يقرأ سجل النجاح كما يكتبه backup.sh", () => {
    expect(parseBackupRecord("lastSuccess", text(success))).toEqual({
      kind: "backup",
      ok: true,
      finishedAt: new Date("2026-11-27T03:12:00Z"),
      snapshot: SNAPSHOT,
      step: null,
      repositoryBytes: 2048,
    });
  });

  it("يقرأ سجل الفشل بخطوته، وفحص السلامة وتجربة الاسترجاع", () => {
    const failed = {
      format: 1,
      kind: "backup",
      ok: false,
      finishedAt: "2026-11-27T03:00:00Z",
      step: "dump",
    };
    expect(parseBackupRecord("lastRun", text(failed))).toMatchObject({ ok: false, step: "dump" });
    const check = {
      format: 1,
      kind: "check",
      ok: true,
      finishedAt: "2026-11-29T02:30:00Z",
      subset: "20%",
    };
    expect(parseBackupRecord("lastCheck", text(check))).toMatchObject({ kind: "check", ok: true });
    const drill = {
      ...success,
      kind: "drill",
      mode: "scratch",
      tables: 28,
      rows: 2654,
      mediaFiles: 40,
    };
    expect(parseBackupRecord("lastDrill", text(drill))).toMatchObject({ kind: "drill", ok: true });
  });

  it("الملف الغائب null، وما لا يطابق الشكل unreadable", () => {
    expect(parseBackupRecord("lastRun", null)).toBeNull();
    for (const bad of [
      "",
      "not json",
      "[]",
      "null",
      text({ ...success, format: 2 }),
      text({ ...success, ok: "yes" }),
      text({ ...success, finishedAt: "2026-11-27 03:12" }),
      text({ ...success, finishedAt: "2026-13-45T99:00:00Z" }),
      text({ ...success, snapshot: "abc" }),
      text({ ...success, repositoryBytes: -1 }),
      text({ ...success, kind: "other" }),
      text({ ...success, step: "Drop Table" }),
    ]) {
      expect(parseBackupRecord("lastRun", bad)).toBe("unreadable");
    }
  });

  it("النوع يطابق الملف: سجل فحص في ملف النسخة، أو «نجاح» فاشل أو بلا لقطة، لا يُقرأ", () => {
    expect(parseBackupRecord("lastRun", text({ ...success, kind: "check" }))).toBe("unreadable");
    expect(parseBackupRecord("lastSuccess", text({ ...success, ok: false }))).toBe("unreadable");
    const noSnapshot = Object.fromEntries(
      Object.entries(success).filter(([key]) => key !== "snapshot"),
    );
    expect(parseBackupRecord("lastSuccess", text(noSnapshot))).toBe("unreadable");
  });
});
