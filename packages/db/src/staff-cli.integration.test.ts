import { sessionExpiry } from "@masar/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDb,
  createStaffSession,
  findStaffCredentialsByEmail,
  issueSessionToken,
  listLiveStaffSessions,
  verifyPassword,
  type Db,
} from "./index";
import { MESSAGES } from "./staff/cli/messages";
import {
  RESET_CONFIRMATION,
  runCreateOwner,
  runResetOwnerMfa,
  runResetOwnerPassword,
  type Terminal,
} from "./staff/cli/owner-commands";
import { createTestClub } from "./test-support/commerce-fixtures";
import { resetCommerceTables } from "./test-support/reset-database";
import { createTestStaff, TEST_STAFF_PASSWORD } from "./test-support/staff-fixtures";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const NOW = new Date("2026-11-26T09:00:00Z");
const GOOD_PASSWORD = "harbor-quilt-ember-93";
const SCRYPT_TIMEOUT_MS = 60_000;

let db: Db;

/** طرفية اختبار: تجيب من قائمتين بالترتيب، وتحفظ ما طُبع وما سُئل مخفيًا. */
function scripted(answers: string[], hidden: string[] = []) {
  const printed: string[] = [];
  const terminal: Terminal = {
    ask: () => Promise.resolve(answers.shift() ?? ""),
    askHidden: () => Promise.resolve(hidden.shift() ?? ""),
    print: (line) => {
      printed.push(line);
    },
  };
  return { terminal, printed };
}

beforeAll(() => {
  db = createDb(url);
});

beforeEach(async () => {
  // الأوامر تختار النادي من القاعدة كلها، فكل اختبار يبدأ من قاعدة بلا أندية اختبار ولا موظفين
  await resetCommerceTables(db);
});

afterAll(async () => {
  await resetCommerceTables(db);
  await db.$disconnect();
});

/** نادي الاختبار ومعه معرّفه كما يكتبه المالك حين توجد أندية أخرى (بيانات المعاينة مثلًا). */
async function clubWithSlug() {
  const id = await createTestClub(db);
  const club = await db.club.findUniqueOrThrow({ where: { id } });
  const others = await db.club.count({ where: { NOT: { id } } });
  return { id, slugAnswer: others === 0 ? [] : [club.slug] };
}

describe("admin:create-owner", () => {
  it(
    "ينشئ المالك بكلمة مرور مجزأة، ويرفض التشغيل الثاني",
    async () => {
      const club = await clubWithSlug();
      const first = scripted(
        [...club.slugAnswer, " Owner@Example.Test ", "خالد المالك"],
        [GOOD_PASSWORD, GOOD_PASSWORD],
      );
      expect(await runCreateOwner(db, first.terminal, NOW)).toBe(true);
      expect(first.printed.at(-1)).toBe(MESSAGES.ownerCreated);
      expect(first.printed).toHaveLength(club.slugAnswer.length + 1);
      const owner = await findStaffCredentialsByEmail(db, "owner@example.test");
      expect(owner).toMatchObject({ role: "owner", status: "active", displayName: "خالد المالك" });
      expect(owner?.passwordHash.startsWith("scrypt$N=131072,r=8,p=1$")).toBe(true);
      expect(await verifyPassword(GOOD_PASSWORD, owner?.passwordHash ?? "")).toBe(true);

      const second = scripted([...club.slugAnswer, "other@example.test", "آخر"], [GOOD_PASSWORD]);
      expect(await runCreateOwner(db, second.terminal, NOW)).toBe(false);
      expect(second.printed.at(-1)).toBe(MESSAGES.ownerExists);
      expect(await findStaffCredentialsByEmail(db, "other@example.test")).toBeNull();
    },
    SCRYPT_TIMEOUT_MS,
  );

  it(
    "يعيد السؤال عند كلمة ضعيفة أو غير متطابقة، ثم يقبل",
    async () => {
      const club = await clubWithSlug();
      const run = scripted(
        [...club.slugAnswer, "not-an-email", "owner2@example.test", "المالك"],
        ["short", "password1234", GOOD_PASSWORD, "different", GOOD_PASSWORD, GOOD_PASSWORD],
      );
      expect(await runCreateOwner(db, run.terminal, NOW)).toBe(false);
      expect(run.printed).toEqual(
        expect.arrayContaining([
          MESSAGES.reasons["staff.email_invalid"],
          MESSAGES.reasons["staff.password_too_short"],
          MESSAGES.reasons["staff.password_common"],
          MESSAGES.passwordMismatch,
          MESSAGES.tooManyAttempts,
        ]),
      );
      expect(await findStaffCredentialsByEmail(db, "owner2@example.test")).toBeNull();
    },
    SCRYPT_TIMEOUT_MS,
  );

  it("كلمة تحوي البريد مرفوضة ولا يُطبع أي سر", async () => {
    const club = await clubWithSlug();
    const leaky = "ownerthree-is-my-name";
    const run = scripted(
      [...club.slugAnswer, "ownerthree@example.test", "المالك"],
      [leaky, leaky, leaky],
    );
    expect(await runCreateOwner(db, run.terminal, NOW)).toBe(false);
    expect(run.printed).toContain(MESSAGES.reasons["staff.password_contains_identity"]);
    expect(run.printed.join("\n")).not.toContain(leaky);
  });
});

describe("admin:reset-owner-mfa", () => {
  it("يمحو الخطوة الثانية ويلغي الجلسات بعد تأكيد حرفي فقط", async () => {
    const club = await clubWithSlug();
    const owner = await createTestStaff(db, club.id, { withTotp: true });
    await createStaffSession(db, {
      staffUserId: owner.id,
      tokenHash: issueSessionToken().tokenHash,
      now: NOW,
      expiresAt: sessionExpiry(NOW),
      mfaVerifiedAt: NOW,
      ip: "10.0.0.1",
      userAgent: "test",
    });
    const cancelled = scripted([owner.email, "reset"]);
    expect(await runResetOwnerMfa(db, cancelled.terminal, NOW)).toBe(false);
    expect((await findStaffCredentialsByEmail(db, owner.email))?.totpEnabled).toBe(true);

    const confirmed = scripted([owner.email, RESET_CONFIRMATION]);
    expect(await runResetOwnerMfa(db, confirmed.terminal, NOW)).toBe(true);
    expect((await findStaffCredentialsByEmail(db, owner.email))?.totpEnabled).toBe(false);
    expect(await listLiveStaffSessions(db, owner.id, NOW)).toEqual([]);
    const log = await db.auditLog.findMany({ where: { entityId: owner.id } });
    expect(log).toMatchObject([{ action: "mfa_reset", actor: "system" }]);
  });

  it("بريد غير مالك أو معطَّل أو مجهول: رسالة واحدة ولا تغيير", async () => {
    const club = await clubWithSlug();
    await createTestStaff(db, club.id);
    const manager = await createTestStaff(db, club.id, { role: "manager", withTotp: true });
    for (const email of [manager.email, "nobody@example.test"]) {
      const run = scripted([email, RESET_CONFIRMATION]);
      expect(await runResetOwnerMfa(db, run.terminal, NOW)).toBe(false);
      expect(run.printed).toEqual([MESSAGES.ownerNotFound]);
    }
    expect((await findStaffCredentialsByEmail(db, manager.email))?.totpEnabled).toBe(true);
  });
});

describe("admin:reset-owner-password", () => {
  it(
    "يكتب كلمة جديدة للمالك بلا إلزام تغيير، والقديمة لا تعمل",
    async () => {
      const club = await clubWithSlug();
      const owner = await createTestStaff(db, club.id);
      const run = scripted([owner.email], [GOOD_PASSWORD, GOOD_PASSWORD]);
      expect(await runResetOwnerPassword(db, run.terminal, NOW)).toBe(true);
      const row = await findStaffCredentialsByEmail(db, owner.email);
      expect(row?.mustChangePassword).toBe(false);
      expect(await verifyPassword(GOOD_PASSWORD, row?.passwordHash ?? "")).toBe(true);
      expect(await verifyPassword(TEST_STAFF_PASSWORD, row?.passwordHash ?? "")).toBe(false);
      const log = await db.auditLog.findMany({ where: { entityId: owner.id } });
      expect(log).toMatchObject([{ action: "password_reset", actor: "system", data: {} }]);
    },
    SCRYPT_TIMEOUT_MS,
  );
});
