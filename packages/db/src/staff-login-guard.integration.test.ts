import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS, ok } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  findStaffCredentialsByEmail,
  inTransaction,
  recordFailedPassword,
  recordPasswordAccepted,
  recordRejectedLogin,
  UNKNOWN_STAFF_ID,
  type Db,
} from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff } from "./test-support/staff-fixtures";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const NOW = new Date("2026-11-26T09:00:00Z");
const HASH = "scrypt$N=1024,r=8,p=1$c2FsdA==$a2V5";
const MINUTE_MS = 60_000;

let db: Db;

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

function audits(staffId: string) {
  return db.auditLog.findMany({ where: { entityId: staffId }, orderBy: { createdAt: "asc" } });
}

describe("عدّ المحاولات والقفل", () => {
  it("الخامسة تقفل 15 دقيقة، وكل فشل والقفل في التدقيق بعنوانه", async () => {
    const clubId = await createTestClub(db);
    const staff = await createTestStaff(db, clubId);
    const attempt = { staffId: staff.id, clubId, ip: "10.9.8.7", at: NOW };
    for (let count = 1; count < MAX_FAILED_LOGINS; count += 1) {
      const outcome = await recordFailedPassword(db, attempt);
      expect(outcome).toMatchObject({ failedLogins: count, lockedNow: false });
    }
    const locked = await recordFailedPassword(db, attempt);
    expect(locked.lockedNow).toBe(true);
    const row = await findStaffCredentialsByEmail(db, staff.email);
    expect(row?.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_MINUTES * MINUTE_MS));
    const log = await audits(staff.id);
    expect(log.filter((entry) => entry.action === "login_failed")).toHaveLength(MAX_FAILED_LOGINS);
    expect(log.filter((entry) => entry.action === "account_locked")).toHaveLength(1);
    expect(log[0]?.data).toEqual({ ip: "10.9.8.7", reason: "bad_password" });
  });

  it("محاولات متزامنة تُعدّ كلها", async () => {
    const clubId = await createTestClub(db);
    const staff = await createTestStaff(db, clubId);
    const attempt = { staffId: staff.id, clubId, ip: "10.9.8.7", at: NOW };
    await Promise.all([1, 2, 3].map(() => recordFailedPassword(db, attempt)));
    expect((await findStaffCredentialsByEmail(db, staff.email))?.failedLogins).toBe(3);
  });

  it("الدخول الناجح يصفّر العدّاد ويسجّل الوقت ويعيد التجزئة إن طُلب", async () => {
    const clubId = await createTestClub(db);
    const staff = await createTestStaff(db, clubId);
    const attempt = { staffId: staff.id, clubId, ip: "10.9.8.7", at: NOW };
    await recordFailedPassword(db, attempt);
    await inTransaction(db, async (tx) => {
      await recordPasswordAccepted(tx, { ...attempt, rehashedPassword: HASH });
      return ok(null);
    });
    const row = await findStaffCredentialsByEmail(db, staff.email);
    expect(row).toMatchObject({ failedLogins: 0, lastLoginAt: NOW, passwordHash: HASH });
    expect((await audits(staff.id)).at(-1)).toMatchObject({
      action: "login_succeeded",
      data: { ip: "10.9.8.7" },
    });
  });

  it("محاولة على بريد بلا حساب تُسجَّل بلا البريد وبفاعل النظام", async () => {
    const clubId = await createTestClub(db);
    await recordRejectedLogin(db, {
      clubId,
      staffId: null,
      reason: "unknown_account",
      ip: "10.1.1.1",
      at: NOW,
    });
    const [entry] = await db.auditLog.findMany({ where: { clubId, entityId: UNKNOWN_STAFF_ID } });
    expect(entry).toMatchObject({
      action: "login_failed",
      actor: "system",
      data: { ip: "10.1.1.1", reason: "unknown_account" },
    });
  });
});
