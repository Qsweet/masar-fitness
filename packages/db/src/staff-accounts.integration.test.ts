import { ok, sessionExpiry } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  changeStaffStanding,
  createDb,
  createFirstOwner,
  createStaff,
  createStaffSession,
  findStaffCredentialsByEmail,
  findStaffInClub,
  inTransaction,
  issueSessionToken,
  listLiveStaffSessions,
  listStaff,
  setStaffPassword,
  staffActor,
  type Db,
} from "./index";
import { createTestClub } from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, uniqueStaffEmail, type TestStaff } from "./test-support/staff-fixtures";

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

async function openSession(staff: TestStaff): Promise<void> {
  await createStaffSession(db, {
    staffUserId: staff.id,
    tokenHash: issueSessionToken().tokenHash,
    now: NOW,
    expiresAt: sessionExpiry(NOW),
    mfaVerifiedAt: NOW,
    ip: "10.0.0.9",
    userAgent: "test",
  });
}

function audits(staffId: string) {
  return db.auditLog.findMany({ where: { entityId: staffId }, orderBy: { createdAt: "asc" } });
}

describe("إنشاء الموظفين", () => {
  it("ينشئ الحساب بكلمة مؤقتة ويسجّله باسم من أنشأه", async () => {
    const clubId = await createTestClub(db);
    const owner = await createTestStaff(db, clubId);
    const email = uniqueStaffEmail();
    const created = await createStaff(db, {
      clubId,
      email,
      displayName: "سارة المبيعات",
      role: "sales",
      passwordHash: HASH,
      mustChangePassword: true,
      actor: staffActor(owner.id),
      at: NOW,
    });
    expect(created.ok && created.value).toMatchObject({
      email,
      role: "sales",
      status: "active",
      mustChangePassword: true,
      totpEnabled: false,
    });
    const id = created.ok ? created.value.id : "";
    const log = await audits(id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      entityType: "staff_user",
      action: "staff_created",
      actor: `staff:${owner.id}`,
      toState: "sales",
      data: {},
    });
    expect(await listStaff(db, clubId)).toHaveLength(2);
    expect(await findStaffInClub(db, await createTestClub(db), id)).toBeNull();
  });

  it("بريد مستعمل = تعارض على حقل البريد", async () => {
    const clubId = await createTestClub(db);
    const existing = await createTestStaff(db, clubId);
    const duplicate = await createStaff(db, {
      clubId,
      email: existing.email,
      displayName: "مكرر",
      role: "editor",
      passwordHash: HASH,
      mustChangePassword: true,
      actor: "system",
      at: NOW,
    });
    expect(!duplicate.ok && duplicate.error).toMatchObject({
      code: "conflict",
      reason: "staff.email_taken",
      field: "email",
    });
  });

  it("أول مالك يُنشأ مرة: الثاني يُرفض، والمتزامنان ينجح أحدهما", async () => {
    const clubId = await createTestClub(db);
    const attempt = () =>
      createFirstOwner(db, {
        clubId,
        email: uniqueStaffEmail(),
        displayName: "المالك",
        passwordHash: HASH,
        at: NOW,
      });
    const results = await Promise.all([attempt(), attempt(), attempt()]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const refused = await attempt();
    expect(!refused.ok && refused.error.reason).toBe("staff.owner_exists");
    const [owner] = await listStaff(db, clubId);
    expect(owner).toMatchObject({ role: "owner", mustChangePassword: false });
    expect((await audits(owner?.id ?? ""))[0]).toMatchObject({
      action: "staff_created",
      actor: "system",
    });
  });
});

describe("تغيير الدور والحالة", () => {
  it("تغيير الدور يلغي جلسات الموظف ويُسجَّل قبل وبعد", async () => {
    const clubId = await createTestClub(db);
    const owner = await createTestStaff(db, clubId);
    const staff = await createTestStaff(db, clubId, { role: "sales" });
    await openSession(staff);
    const changed = await changeStaffStanding(db, {
      clubId,
      staffId: staff.id,
      next: { role: "manager" },
      actor: staffActor(owner.id),
      at: NOW,
    });
    expect(changed.ok && changed.value.role).toBe("manager");
    expect(await listLiveStaffSessions(db, staff.id, NOW)).toEqual([]);
    expect(await audits(staff.id)).toMatchObject([
      {
        action: "role_changed",
        fromState: "sales",
        toState: "manager",
        actor: `staff:${owner.id}`,
      },
    ]);
  });

  it("التعطيل ثم التفعيل يُسجَّلان، وتغيير بلا فرق لا يكتب شيئًا", async () => {
    const clubId = await createTestClub(db);
    const owner = await createTestStaff(db, clubId);
    const staff = await createTestStaff(db, clubId, { role: "editor" });
    const base = { clubId, staffId: staff.id, actor: staffActor(owner.id), at: NOW };
    await changeStaffStanding(db, { ...base, next: { status: "disabled" } });
    await changeStaffStanding(db, { ...base, next: { status: "disabled" } });
    await changeStaffStanding(db, { ...base, next: { status: "active" } });
    const actions = (await audits(staff.id)).map((row) => row.action);
    expect(actions).toEqual(["staff_disabled", "staff_enabled"]);
  });

  it("آخر مالك نشط لا يُعطَّل ولا يُنزَّل، ولا أثر للمحاولة", async () => {
    const clubId = await createTestClub(db);
    const owner = await createTestStaff(db, clubId);
    await openSession(owner);
    const base = { clubId, staffId: owner.id, actor: staffActor(owner.id), at: NOW };
    for (const next of [{ status: "disabled" }, { role: "manager" }] as const) {
      const refused = await changeStaffStanding(db, { ...base, next });
      expect(!refused.ok && refused.error.reason).toBe("staff.last_owner");
    }
    expect(await listLiveStaffSessions(db, owner.id, NOW)).toHaveLength(1);
    expect(await audits(owner.id)).toEqual([]);
  });

  it("مالكان يتبادلان التنزيل معًا: يبقى مالك واحد", async () => {
    const clubId = await createTestClub(db);
    const owners = await Promise.all([createTestStaff(db, clubId), createTestStaff(db, clubId)]);
    const results = await Promise.all(
      owners.map((owner) =>
        changeStaffStanding(db, {
          clubId,
          staffId: owner.id,
          next: { role: "manager" },
          actor: "system",
          at: NOW,
        }),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const reasons = results.map((result) => (result.ok ? null : result.error.reason));
    expect(reasons.filter((reason) => reason !== null)).toEqual(["staff.last_owner"]);
  });

  it("موظف من نادٍ آخر غير موجود", async () => {
    const clubId = await createTestClub(db);
    const foreign = await createTestStaff(db, await createTestClub(db), { role: "sales" });
    const result = await changeStaffStanding(db, {
      clubId,
      staffId: foreign.id,
      next: { status: "disabled" },
      actor: "system",
      at: NOW,
    });
    expect(!result.ok && result.error.reason).toBe("staff.not_found");
  });
});

describe("كلمة المرور", () => {
  it("تغييرها يمحو سر تسجيل معلّقًا لم يؤكَّد، ولا يمسّ خطوة ثانية مفعّلة", async () => {
    const clubId = await createTestClub(db);
    const pending = await createTestStaff(db, clubId, { role: "sales" });
    const enrolled = await createTestStaff(db, clubId, { role: "sales", withTotp: true });
    await db.staffUser.update({
      where: { id: pending.id },
      data: { totpSecretEnc: "v1.pending.secret.box", totpLastStep: 7n },
    });
    for (const staff of [pending, enrolled]) {
      await inTransaction(db, async (tx) => {
        await setStaffPassword(tx, {
          clubId,
          staffId: staff.id,
          passwordHash: HASH,
          action: "password_reset",
          mustChangePassword: true,
          actor: "system",
          at: NOW,
        });
        return ok(null);
      });
    }
    const cleared = await findStaffCredentialsByEmail(db, pending.email);
    expect(cleared).toMatchObject({ totpSecretEnc: null, totpLastStep: null, totpEnabled: false });
    const kept = await findStaffCredentialsByEmail(db, enrolled.email);
    expect(kept?.totpEnabled).toBe(true);
    expect(kept?.totpSecretEnc).not.toBeNull();
  });

  it("تغييرها يلغي كل الجلسات ويرفع القفل ويُسجَّل بلا أي سر", async () => {
    const clubId = await createTestClub(db);
    const staff = await createTestStaff(db, clubId, { mustChangePassword: true });
    await openSession(staff);
    await db.staffUser.update({
      where: { id: staff.id },
      data: { failedLogins: 3, lockedUntil: new Date(NOW.getTime() + MINUTE_MS) },
    });
    await inTransaction(db, async (tx) => {
      await setStaffPassword(tx, {
        clubId,
        staffId: staff.id,
        passwordHash: HASH,
        action: "password_changed",
        mustChangePassword: false,
        actor: staffActor(staff.id),
        at: NOW,
      });
      return ok(null);
    });
    const row = await findStaffCredentialsByEmail(db, staff.email);
    expect(row).toMatchObject({
      passwordHash: HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    });
    expect(await listLiveStaffSessions(db, staff.id, NOW)).toEqual([]);
    const [entry] = await audits(staff.id);
    expect(entry).toMatchObject({ action: "password_changed", data: {} });
    expect(JSON.stringify(entry)).not.toContain(HASH);
  });
});
