import { ok } from "@masar/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptTotpStep,
  completeTotpEnrolment,
  consumeRecoveryCode,
  createDb,
  findStaffCredentialsById,
  inTransaction,
  issueRecoveryCodes,
  normalizeRecoveryCode,
  recordMfaOutcome,
  recoveryCodeHash,
  resetTotp,
  savePendingTotpSecret,
  staffActor,
  writeStaffAudit,
  type Db,
  type Tx,
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
const STEP = 59_000_000;
const PENDING = "v1.aaaa.bbbb.cccc";

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

async function run(work: (tx: Tx) => Promise<unknown>) {
  return inTransaction(db, async (tx) => ok(await work(tx)));
}

function hashOf(code: string): string {
  return recoveryCodeHash(normalizeRecoveryCode(code) ?? "");
}

describe("تسجيل الخطوة الثانية", () => {
  it("سر معلّق ثم تفعيل برمز التأكيد وعشرة رموز استرجاع مجزأة", async () => {
    const staff = await createTestStaff(db, clubId);
    expect(await savePendingTotpSecret(db, staff.id, PENDING)).toBe(true);
    expect((await findStaffCredentialsById(db, staff.id))?.totpEnabled).toBe(false);
    const { codes, hashes } = issueRecoveryCodes();
    await run((tx) =>
      completeTotpEnrolment(tx, { staff, step: STEP, recoveryCodeHashes: hashes, at: NOW }),
    );
    const row = await findStaffCredentialsById(db, staff.id);
    expect(row).toMatchObject({ totpEnabled: true, totpLastStep: STEP, totpSecretEnc: PENDING });
    const stored = await db.staffRecoveryCode.findMany({ where: { staffUserId: staff.id } });
    expect(stored).toHaveLength(codes.length);
    expect(stored.map((code) => code.codeHash).sort()).toEqual([...hashes].sort());
    expect(JSON.stringify(stored)).not.toContain(codes[0]);
    const log = await db.auditLog.findMany({ where: { entityId: staff.id } });
    expect(log).toMatchObject([{ action: "mfa_enrolled", actor: `staff:${staff.id}`, data: {} }]);
  });

  it("سر معلّق لا يستبدل خطوة مفعّلة، والتفعيل مرتين مرفوض", async () => {
    const staff = await createTestStaff(db, clubId, { withTotp: true });
    expect(await savePendingTotpSecret(db, staff.id, PENDING)).toBe(false);
    const again = await inTransaction(db, async (tx) => {
      await completeTotpEnrolment(tx, { staff, step: STEP, recoveryCodeHashes: [], at: NOW });
      return ok(null);
    });
    expect(!again.ok && again.error.reason).toBe("staff.mfa_already_enrolled");
  });

  it("لا تفعيل بلا سر معلّق", async () => {
    const staff = await createTestStaff(db, clubId);
    const result = await inTransaction(db, async (tx) => {
      await completeTotpEnrolment(tx, { staff, step: STEP, recoveryCodeHashes: [], at: NOW });
      return ok(null);
    });
    expect(result.ok).toBe(false);
  });
});

describe("منع إعادة الرمز", () => {
  it("الخطوة تُقبل مرة، وما قبلها مرفوض، وما بعدها مقبول", async () => {
    const staff = await createTestStaff(db, clubId, { withTotp: true });
    expect(await acceptTotpStep(db, staff.id, STEP)).toBe(true);
    expect(await acceptTotpStep(db, staff.id, STEP)).toBe(false);
    expect(await acceptTotpStep(db, staff.id, STEP - 1)).toBe(false);
    expect(await acceptTotpStep(db, staff.id, STEP + 1)).toBe(true);
  });

  it("طلبات متزامنة بالرمز نفسه: ينجح واحد فقط", async () => {
    const staff = await createTestStaff(db, clubId, { withTotp: true });
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => acceptTotpStep(db, staff.id, STEP)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("لا تُقبل خطوة لحساب بلا سر", async () => {
    const staff = await createTestStaff(db, clubId);
    expect(await acceptTotpStep(db, staff.id, STEP)).toBe(false);
  });
});

describe("رموز الاسترجاع مرة واحدة", () => {
  async function enrolled() {
    const staff = await createTestStaff(db, clubId);
    await savePendingTotpSecret(db, staff.id, PENDING);
    const issued = issueRecoveryCodes();
    await run((tx) =>
      completeTotpEnrolment(tx, { staff, step: STEP, recoveryCodeHashes: issued.hashes, at: NOW }),
    );
    return { staff, codes: issued.codes };
  }

  it("الرمز يُستهلك مرة ويُسجَّل مع عدد الباقي بلا الرمز نفسه", async () => {
    const { staff, codes } = await enrolled();
    const codeHash = hashOf(codes[0] ?? "");
    const first = await run((tx) => consumeRecoveryCode(tx, { staff, codeHash, at: NOW }));
    const second = await run((tx) => consumeRecoveryCode(tx, { staff, codeHash, at: NOW }));
    expect(first.ok && first.value).toBe(true);
    expect(second.ok && second.value).toBe(false);
    const log = await db.auditLog.findMany({
      where: { entityId: staff.id, action: "recovery_code_used" },
    });
    expect(log).toHaveLength(1);
    expect(log[0]?.data).toEqual({ remaining: codes.length - 1 });
    expect(JSON.stringify(log)).not.toContain(codeHash);
  });

  it("استعمالان متزامنان للرمز نفسه: ينجح واحد", async () => {
    const { staff, codes } = await enrolled();
    const codeHash = hashOf(codes[1] ?? "");
    const results = await Promise.all(
      [1, 2, 3].map(() => run((tx) => consumeRecoveryCode(tx, { staff, codeHash, at: NOW }))),
    );
    expect(results.filter((result) => result.ok && result.value === true)).toHaveLength(1);
  });

  it("رمز موظف آخر أو رمز مجهول مرفوض", async () => {
    const { staff } = await enrolled();
    const other = await enrolled();
    const foreign = hashOf(other.codes[0] ?? "");
    const result = await run((tx) =>
      consumeRecoveryCode(tx, { staff, codeHash: foreign, at: NOW }),
    );
    expect(result.ok && result.value).toBe(false);
  });
});

describe("إعادة الضبط", () => {
  it("تمحو السر والرموز وتلغي الجلسات وتُسجَّل باسم المالك", async () => {
    const owner = await createTestStaff(db, clubId);
    const staff = await createTestStaff(db, clubId, { role: "sales", withTotp: true });
    const { hashes } = issueRecoveryCodes();
    await db.staffRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ staffUserId: staff.id, codeHash })),
    });
    await run((tx) => resetTotp(tx, { staff, actor: staffActor(owner.id), at: NOW }));
    const row = await findStaffCredentialsById(db, staff.id);
    expect(row).toMatchObject({ totpEnabled: false, totpSecretEnc: null, totpLastStep: null });
    expect(await db.staffRecoveryCode.count({ where: { staffUserId: staff.id } })).toBe(0);
    const log = await db.auditLog.findMany({ where: { entityId: staff.id } });
    expect(log).toMatchObject([{ action: "mfa_reset", actor: `staff:${owner.id}` }]);
  });
});

describe("تدقيق الخطوة الثانية بلا أسرار", () => {
  it("النجاح والفشل يُسجَّلان بالطريقة فقط", async () => {
    const staff = await createTestStaff(db, clubId, { withTotp: true });
    await run((tx) =>
      recordMfaOutcome(tx, { staff, action: "mfa_failed", method: "totp", at: NOW }),
    );
    await run((tx) =>
      recordMfaOutcome(tx, { staff, action: "mfa_verified", method: "recovery", at: NOW }),
    );
    const log = await db.auditLog.findMany({
      where: { entityId: staff.id },
      orderBy: { id: "asc" },
    });
    expect(log.map((entry) => [entry.action, entry.data])).toEqual([
      ["mfa_failed", { method: "totp" }],
      ["mfa_verified", { method: "recovery" }],
    ]);
  });

  it.each(["password", "totpSecret", "sessionToken", "recoveryCode", "passwordHash", "email"])(
    "مفتاح «%s» في بيانات التدقيق خلل يُرمى",
    async (key) => {
      const staff = await createTestStaff(db, clubId, { role: "sales" });
      const write = inTransaction(db, async (tx) => {
        await writeStaffAudit(tx, {
          clubId,
          staffId: staff.id,
          action: "login_failed",
          actor: "system",
          data: { [key]: "x" },
          at: NOW,
        });
        return ok(null);
      });
      await expect(write).rejects.toThrow("audit.secret_data");
      expect(await db.auditLog.count({ where: { entityId: staff.id } })).toBe(0);
    },
  );
});
