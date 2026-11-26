import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./index";
import { sha256Hex } from "./staff/crypto";
import { createTestClub } from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, uniqueStaffEmail } from "./test-support/staff-fixtures";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const NOW = new Date("2026-11-26T09:00:00Z");
const LATER = new Date("2026-11-26T21:00:00Z");
const VALID_HASH = "scrypt$N=1024,r=8,p=1$c2FsdA==$a2V5";

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

function staffRow(overrides: Record<string, unknown> = {}) {
  return {
    clubId,
    email: uniqueStaffEmail(),
    displayName: "موظف",
    role: "sales" as const,
    passwordHash: VALID_HASH,
    ...overrides,
  };
}

describe("قيود staff_users", () => {
  it.each([
    ["بريد بحروف كبيرة", { email: "Owner@Example.test" }],
    ["بريد بلا نطاق", { email: "owner@example" }],
    ["اسم بمسافة في أوله", { displayName: " موظف" }],
    ["اسم من حرف واحد", { displayName: "م" }],
    ["كلمة مرور غير مجزأة", { passwordHash: "plain-password" }],
    ["عدّاد سالب", { failedLogins: -1 }],
    ["خطوة ثانية مفعّلة بلا سر", { totpEnabledAt: NOW }],
    ["خطوة مستعملة بلا سر", { totpLastStep: 5n }],
  ])("%s مرفوض", async (_name, overrides) => {
    await expect(db.staffUser.create({ data: staffRow(overrides) })).rejects.toThrow();
  });

  it("البريد فريد", async () => {
    const email = uniqueStaffEmail();
    await db.staffUser.create({ data: staffRow({ email }) });
    await expect(db.staffUser.create({ data: staffRow({ email }) })).rejects.toThrow(
      "staff_users_email_key",
    );
  });

  it("الموظف لا يُحذف ولا ينتقل إلى نادٍ آخر", async () => {
    const staff = await createTestStaff(db, clubId, { role: "sales" });
    await expect(db.staffUser.delete({ where: { id: staff.id } })).rejects.toThrow(
      "staff_user_delete_forbidden",
    );
    const otherClub = await createTestClub(db);
    const move = db.staffUser.update({ where: { id: staff.id }, data: { clubId: otherClub } });
    await expect(move).rejects.toThrow("staff_user_identity_immutable");
  });
});

describe("المحفّز S1: مالك نشط واحد على الأقل", () => {
  it("المالك الوحيد لا يُعطَّل ولا يُنزَّل", async () => {
    const club = await createTestClub(db);
    const owner = await createTestStaff(db, club);
    const disable = db.staffUser.update({ where: { id: owner.id }, data: { status: "disabled" } });
    await expect(disable).rejects.toThrow("staff_last_owner_required");
    const demote = db.staffUser.update({ where: { id: owner.id }, data: { role: "manager" } });
    await expect(demote).rejects.toThrow("staff_last_owner_required");
  });

  it("مع مالك نشط آخر يُقبل، والباقي يصير هو الأخير", async () => {
    const club = await createTestClub(db);
    const first = await createTestStaff(db, club);
    const second = await createTestStaff(db, club);
    await db.staffUser.update({ where: { id: first.id }, data: { role: "manager" } });
    const last = db.staffUser.update({ where: { id: second.id }, data: { status: "disabled" } });
    await expect(last).rejects.toThrow("staff_last_owner_required");
  });

  it("مالك معطَّل لا يُعدّ", async () => {
    const club = await createTestClub(db);
    const active = await createTestStaff(db, club);
    await createTestStaff(db, club, { status: "disabled" });
    const demote = db.staffUser.update({ where: { id: active.id }, data: { role: "editor" } });
    await expect(demote).rejects.toThrow("staff_last_owner_required");
  });

  it("تنزيلان متزامنان لمالكَين: ينجح واحد فقط", async () => {
    const club = await createTestClub(db);
    const owners = await Promise.all([createTestStaff(db, club), createTestStaff(db, club)]);
    const results = await Promise.allSettled(
      owners.map((owner) =>
        db.staffUser.update({ where: { id: owner.id }, data: { role: "manager" } }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.staffUser.count({ where: { clubId: club, role: "owner" } })).toBe(1);
  });

  it("تغيير غير المالك لا يمسّه المحفّز", async () => {
    const club = await createTestClub(db);
    const sales = await createTestStaff(db, club, { role: "sales" });
    await db.staffUser.update({ where: { id: sales.id }, data: { status: "disabled" } });
    const row = await db.staffUser.findUniqueOrThrow({ where: { id: sales.id } });
    expect(row.status).toBe("disabled");
  });
});

describe("المحفّز S3: الجلسة سجل", () => {
  async function session(overrides: Record<string, unknown> = {}) {
    const staff = await createTestStaff(db, clubId, { role: "sales" });
    return db.staffSession.create({
      data: {
        staffUserId: staff.id,
        tokenHash: sha256Hex(randomUUID()),
        createdAt: NOW,
        lastSeenAt: NOW,
        expiresAt: LATER,
        ip: "10.0.0.1",
        userAgent: "test",
        ...overrides,
      },
    });
  }

  it.each([
    ["رمز بلا شكل SHA-256", { tokenHash: "abc" }],
    ["انتهاء قبل الإنشاء", { expiresAt: NOW }],
    ["عنوان فارغ", { ip: "" }],
    ["متصفح أطول من 255", { userAgent: "x".repeat(256) }],
  ])("%s مرفوض", async (_name, overrides) => {
    await expect(session(overrides)).rejects.toThrow();
  });

  it("الرمز وموعد الانتهاء ثابتان", async () => {
    const row = await session();
    const retoken = db.staffSession.update({
      where: { id: row.id },
      data: { tokenHash: sha256Hex("other") },
    });
    await expect(retoken).rejects.toThrow("staff_session_immutable");
    const extend = db.staffSession.update({
      where: { id: row.id },
      data: { expiresAt: new Date(LATER.getTime() + 1) },
    });
    await expect(extend).rejects.toThrow("staff_session_immutable");
  });

  it("الإلغاء وإثبات الخطوة الثانية يُكتبان مرة ولا يُمحيان", async () => {
    const row = await session();
    const data = { revokedAt: NOW, mfaVerifiedAt: NOW };
    await db.staffSession.update({ where: { id: row.id }, data });
    const unrevoke = db.staffSession.update({ where: { id: row.id }, data: { revokedAt: null } });
    await expect(unrevoke).rejects.toThrow("staff_session_final");
    const unverify = db.staffSession.update({
      where: { id: row.id },
      data: { mfaVerifiedAt: null },
    });
    await expect(unverify).rejects.toThrow("staff_session_final");
  });

  it("الجلسة لا تُحذف", async () => {
    const row = await session();
    await expect(db.staffSession.delete({ where: { id: row.id } })).rejects.toThrow(
      "staff_session_delete_forbidden",
    );
  });
});

describe("المحفّز S4: رمز الاسترجاع مرة واحدة", () => {
  it("used_at يُكتب مرة، والرمز ثابت، والحذف مسموح", async () => {
    const staff = await createTestStaff(db, clubId, { role: "sales" });
    const code = await db.staffRecoveryCode.create({
      data: { staffUserId: staff.id, codeHash: sha256Hex(randomUUID()) },
    });
    const recode = db.staffRecoveryCode.update({
      where: { id: code.id },
      data: { codeHash: sha256Hex("x") },
    });
    await expect(recode).rejects.toThrow("staff_recovery_code_used_once");
    await db.staffRecoveryCode.update({ where: { id: code.id }, data: { usedAt: NOW } });
    const reuse = db.staffRecoveryCode.update({ where: { id: code.id }, data: { usedAt: null } });
    await expect(reuse).rejects.toThrow("staff_recovery_code_used_once");
    await db.staffRecoveryCode.delete({ where: { id: code.id } });
    expect(await db.staffRecoveryCode.count({ where: { id: code.id } })).toBe(0);
  });
});

describe("audit_logs يقبل فاعل الموظف بمعرّفه", () => {
  function audit(actor: string, entityType = "staff_user") {
    return db.auditLog.create({
      data: { clubId, entityType, entityId: randomUUID(), action: "test", actor, createdAt: NOW },
    });
  }

  it("staff:<uuid> و system مقبولان، وغيرهما مرفوض", async () => {
    await audit(`staff:${randomUUID()}`);
    await audit("system");
    await expect(audit("staff:not-a-uuid")).rejects.toThrow("audit_logs_actor_known");
    await expect(audit("admin")).rejects.toThrow("audit_logs_actor_known");
    await expect(audit("system", "staff_session")).rejects.toThrow("audit_logs_entity_type_known");
  });

  it("يبقى للإلحاق فقط", async () => {
    const row = await audit("system");
    const edit = db.auditLog.update({ where: { id: row.id }, data: { action: "edited" } });
    await expect(edit).rejects.toThrow("audit_log_append_only");
    await expect(db.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(
      "audit_log_append_only",
    );
  });
});
