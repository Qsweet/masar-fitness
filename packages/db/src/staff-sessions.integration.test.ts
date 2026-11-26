import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, sessionExpiry } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  createStaffSession,
  findSessionByTokenHash,
  inTransaction,
  issueSessionToken,
  listLiveStaffSessions,
  revokeAllStaffSessions,
  revokeStaffSession,
  rotateStaffSession,
  touchStaffSession,
  type Db,
} from "./index";
import { ok } from "@masar/domain";
import { createTestClub } from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, type TestStaff } from "./test-support/staff-fixtures";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const LOGIN = new Date("2026-11-26T08:00:00Z");
const MINUTE_MS = 60_000;

let db: Db;
let clubId: string;

beforeAll(async () => {
  db = createDb(url);
  await resetCommerceTables(db);
  clubId = await createTestClub(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

async function login(staff: TestStaff, at: Date = LOGIN, mfaVerifiedAt: Date | null = null) {
  const issued = issueSessionToken();
  const id = await createStaffSession(db, {
    staffUserId: staff.id,
    tokenHash: issued.tokenHash,
    now: at,
    expiresAt: sessionExpiry(at),
    mfaVerifiedAt,
    ip: "10.1.2.3",
    userAgent: "Mozilla/5.0 test",
  });
  return { id, ...issued };
}

describe("إنشاء الجلسة وقراءتها", () => {
  it("تُحفظ التجزئة لا الرمز، ويُقصّ المتصفح الطويل", async () => {
    const staff = await createTestStaff(db, clubId);
    const issued = issueSessionToken();
    const id = await createStaffSession(db, {
      staffUserId: staff.id,
      tokenHash: issued.tokenHash,
      now: LOGIN,
      expiresAt: sessionExpiry(LOGIN),
      mfaVerifiedAt: null,
      ip: "10.1.2.3",
      userAgent: "x".repeat(400),
    });
    const row = await db.staffSession.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(issued.tokenHash);
    expect(JSON.stringify(row)).not.toContain(issued.token);
    expect(row.userAgent).toHaveLength(255);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(SESSION_ABSOLUTE_MS);
  });

  it("تُقرأ بتجزئة رمزها مع صاحبها، ورمز مجهول = null", async () => {
    const staff = await createTestStaff(db, clubId, { role: "manager" });
    const session = await login(staff);
    const found = await findSessionByTokenHash(db, session.tokenHash);
    expect(found?.session.id).toBe(session.id);
    expect(found?.staff).toMatchObject({ id: staff.id, role: "manager", totpEnabled: false });
    expect(await findSessionByTokenHash(db, issueSessionToken().tokenHash)).toBeNull();
  });
});

describe("الخمول والحد المطلق والإلغاء", () => {
  it("النشاط يحدّث آخر ظهور، ولا يمدّ الحد المطلق", async () => {
    const staff = await createTestStaff(db, clubId);
    const session = await login(staff);
    const seen = new Date(LOGIN.getTime() + 10 * MINUTE_MS);
    await touchStaffSession(db, session.id, seen);
    const row = await db.staffSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.lastSeenAt).toEqual(seen);
    expect(row.expiresAt).toEqual(sessionExpiry(LOGIN));
  });

  it("«جلساتي» تعرض الحيّة فقط: لا خاملة ولا منتهية ولا ملغاة", async () => {
    const staff = await createTestStaff(db, clubId);
    const live = await login(staff);
    const idle = await login(staff);
    const revoked = await login(staff);
    const now = new Date(LOGIN.getTime() + SESSION_IDLE_MS);
    await touchStaffSession(db, live.id, new Date(now.getTime() - MINUTE_MS));
    await revokeAllStaffSessions(db, staff.id, now, live.id);
    const sessions = await listLiveStaffSessions(db, staff.id, now);
    expect(sessions.map((session) => session.id)).toEqual([live.id]);
    expect([idle.id, revoked.id]).not.toContain(sessions[0]?.id);
    const pastAbsolute = new Date(LOGIN.getTime() + SESSION_ABSOLUTE_MS);
    await touchStaffSession(db, live.id, new Date(pastAbsolute.getTime() - 1));
    expect(await listLiveStaffSessions(db, staff.id, pastAbsolute)).toEqual([]);
  });

  it("النشاط لا يُكتب على جلسة ملغاة", async () => {
    const staff = await createTestStaff(db, clubId);
    const session = await login(staff);
    await revokeAllStaffSessions(db, staff.id, LOGIN);
    await touchStaffSession(db, session.id, new Date(LOGIN.getTime() + MINUTE_MS));
    const row = await db.staffSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.lastSeenAt).toEqual(LOGIN);
  });

  it("إلغاء الكل يستثني جلسة واحدة عند الطلب ويرجع العدد", async () => {
    const staff = await createTestStaff(db, clubId);
    const keep = await login(staff);
    await login(staff);
    await login(staff);
    expect(await revokeAllStaffSessions(db, staff.id, LOGIN, keep.id)).toBe(2);
    expect(await revokeAllStaffSessions(db, staff.id, LOGIN)).toBe(1);
    expect(await revokeAllStaffSessions(db, staff.id, LOGIN)).toBe(0);
  });

  it("الخروج يلغي الجلسة ويُسجَّل، وإلغاء جلسة موظف آخر مرفوض بلا أثر", async () => {
    const staff = await createTestStaff(db, clubId);
    const other = await createTestStaff(db, clubId, { role: "sales" });
    const session = await login(staff);
    const foreign = await revokeStaffSession(db, {
      sessionId: session.id,
      staff: other,
      action: "session_revoked",
      at: LOGIN,
    });
    expect(!foreign.ok && foreign.error.reason).toBe("staff.session_not_found");
    const done = await revokeStaffSession(db, {
      sessionId: session.id,
      staff,
      action: "logout",
      at: LOGIN,
    });
    expect(done.ok).toBe(true);
    const row = await db.staffSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.revokedAt).toEqual(LOGIN);
    const audits = await db.auditLog.findMany({ where: { entityId: staff.id, action: "logout" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actor: `staff:${staff.id}`, data: { session: session.id } });
    const again = await revokeStaffSession(db, {
      sessionId: session.id,
      staff,
      action: "logout",
      at: LOGIN,
    });
    expect(again.ok).toBe(false);
  });
});

describe("تدوير الرمز", () => {
  it("رمز جديد، والقديمة ملغاة، والحد المطلق موروث، وإثبات الخطوة الثانية يُكتب", async () => {
    const staff = await createTestStaff(db, clubId);
    const old = await login(staff);
    const next = issueSessionToken();
    const at = new Date(LOGIN.getTime() + 5 * MINUTE_MS);
    const rotated = await inTransaction(db, async (tx) =>
      ok(
        await rotateStaffSession(tx, {
          sessionId: old.id,
          tokenHash: next.tokenHash,
          now: at,
          mfaVerifiedAt: at,
        }),
      ),
    );
    const newId = rotated.ok ? rotated.value : null;
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(old.id);
    expect((await findSessionByTokenHash(db, old.tokenHash))?.session.revokedAt).toEqual(at);
    const fresh = await findSessionByTokenHash(db, next.tokenHash);
    expect(fresh?.session).toMatchObject({
      id: newId,
      expiresAt: sessionExpiry(LOGIN),
      mfaVerifiedAt: at,
      revokedAt: null,
      ip: "10.1.2.3",
    });
  });

  it("تدوير بلا خطوة ثانية يورّث حالتها", async () => {
    const staff = await createTestStaff(db, clubId);
    const verified = await login(staff, LOGIN, LOGIN);
    const next = issueSessionToken();
    await inTransaction(db, async (tx) =>
      ok(
        await rotateStaffSession(tx, {
          sessionId: verified.id,
          tokenHash: next.tokenHash,
          now: LOGIN,
        }),
      ),
    );
    expect((await findSessionByTokenHash(db, next.tokenHash))?.session.mfaVerifiedAt).toEqual(
      LOGIN,
    );
  });

  it("جلسة ملغاة لا تُدوَّر", async () => {
    const staff = await createTestStaff(db, clubId);
    const session = await login(staff);
    await revokeAllStaffSessions(db, staff.id, LOGIN);
    const next = issueSessionToken();
    const rotated = await inTransaction(db, async (tx) =>
      ok(
        await rotateStaffSession(tx, {
          sessionId: session.id,
          tokenHash: next.tokenHash,
          now: LOGIN,
        }),
      ),
    );
    expect(rotated.ok && rotated.value).toBeNull();
    expect(await findSessionByTokenHash(db, next.tokenHash)).toBeNull();
  });
});
