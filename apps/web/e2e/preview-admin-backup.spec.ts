import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { backupStatusDir } from "./admin-env";
import { newClub, newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * حالات تنبيه النسخ الاحتياطي في «نظرة عامة» (docs/BACKUP.md §9): الاختبار يكتب ملفات السجل كما
 * يكتبها backup.sh في مجلد يقرؤه خادم اللوحة مع كل طلب. المجلد لهذا الخادم وحده، والحالات متتابعة.
 * التوافق مع `BACKUP_CONFIGURED` (لا سجل ولا إعلان ⇒ تنبيه المكتبة) يثبته `admin-slider.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const HOUR_MS = 3_600_000;
const BACKUP = TEXT.backup;
let db: Db;
let dir: string;

/** الوقت كما يكتبه `date -u +%Y-%m-%dT%H:%M:%SZ`. */
const utc = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * HOUR_MS).toISOString().replace(/\.\d{3}Z$/, "Z");

const success = (hoursAgo: number) => ({
  format: 1,
  kind: "backup",
  ok: true,
  finishedAt: utc(hoursAgo),
  snapshot: "d".repeat(64),
  bytesProcessed: 1024,
  bytesAdded: 512,
  repositoryBytes: 2048,
  appVersion: "e2e",
});

async function setRecords(records: Record<string, unknown>): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const [name, value] of Object.entries(records)) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    await writeFile(join(dir, name), `${text}\n`);
  }
}

async function openOverview(page: Page) {
  await page.goto("/admin");
  await expect(page.getByTestId("system-status")).toBeVisible();
  return {
    alert: page.getByTestId("backup-alert"),
    status: page.getByTestId("backup-status"),
    drill: page.getByTestId("backup-drill"),
  };
}

test.beforeAll(({ baseURL }) => {
  db = testDb();
  dir = backupStatusDir(Number(new URL(baseURL ?? "").port));
});

test.afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await db.$disconnect();
});

test("التنبيه الأحمر يتبع سجل النسخ: غائب، حديث، قديم، فاشل، تالف", async ({ page }) => {
  await setRecords({});
  await signIn(page, await newStaff(db, await newClub(db), { withTotp: true }));

  let view = await openOverview(page);
  await expect(view.alert).toHaveAttribute("data-reason", "unmonitored");
  await expect(view.alert).toContainText(BACKUP.reasons.unmonitored);
  await expect(view.status).toHaveAttribute("data-state", "unmonitored");
  await expect(view.drill).toHaveText(BACKUP.system.drillNever);

  await setRecords({ "last-success.json": success(2), "last-run.json": success(2) });
  view = await openOverview(page);
  await expect(view.alert).toHaveCount(0);
  await expect(view.status).toHaveAttribute("data-state", "fresh");
  await expect(view.status).toContainText("آخر نسخة");

  await setRecords({ "last-success.json": success(40) });
  view = await openOverview(page);
  await expect(view.alert).toHaveAttribute("data-reason", "stale");
  await expect(view.alert).toContainText("40");
  await expect(view.alert).toContainText("36");

  const failed = { format: 1, kind: "backup", ok: false, finishedAt: utc(1), step: "upload" };
  await setRecords({ "last-run.json": failed });
  view = await openOverview(page);
  await expect(view.alert).toHaveAttribute("data-reason", "never");
  await expect(view.status).toContainText(BACKUP.system.never);

  await setRecords({ "last-success.json": success(2), "last-check.json": "{oops" });
  view = await openOverview(page);
  await expect(view.alert).toHaveAttribute("data-reason", "unreadable");
});

test("فحص سلامة فاشل ينبّه ولو كانت النسخة حديثة، وتجربة الاسترجاع الناجحة تظهر", async ({
  page,
}) => {
  const check = { format: 1, kind: "check", ok: false, finishedAt: utc(3), step: "check" };
  const drill = { ...success(48), kind: "drill", mode: "scratch", tables: 28, rows: 10 };
  await setRecords({
    "last-success.json": success(1),
    "last-check.json": check,
    "last-drill.json": drill,
  });
  await signIn(page, await newStaff(db, await newClub(db), { withTotp: true }));

  const view = await openOverview(page);
  await expect(view.alert).toHaveAttribute("data-reason", "check_failed");
  await expect(view.status).toContainText(BACKUP.system.checkFailed);
  await expect(view.drill).not.toHaveText(BACKUP.system.drillNever);
  await expect(view.drill.locator("time")).toHaveCount(1);
});

test("المبيعات بلا «حالة النظام» لا ترى تنبيه النسخ", async ({ page }) => {
  await setRecords({});
  await signIn(page, await newStaff(db, await newClub(db), { role: "sales", withTotp: true }));
  await page.goto("/admin");
  await expect(page.getByTestId("kpi-revenue")).toBeVisible();
  await expect(page.getByTestId("backup-alert")).toHaveCount(0);
});
