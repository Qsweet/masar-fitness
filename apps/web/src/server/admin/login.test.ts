import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ترتيب محاولة الدخول وتوحيد الفشل، بقاعدة وتجزئة مستبدلتين. السلوك الحقيقي على القاعدة مختبر في
 * `packages/db` (العدّ والقفل والتدقيق) وفي المتصفح (`e2e/admin.spec.ts`).
 */
const NOW = new Date("2026-11-26T10:00:00Z");
const META = { ip: "203.0.113.7", userAgent: "vitest" };
const STAFF = {
  id: "018f4e2a-0000-7000-8000-000000000001",
  clubId: "018f4e2a-0000-7000-8000-000000000002",
  email: "owner@example.test",
  status: "active",
  passwordHash: "stored-hash",
  failedLogins: 0,
  lockedUntil: null as Date | null,
};

const db = {
  findStaffCredentialsByEmail: vi.fn(),
  verifyPassword: vi.fn(),
  verifyAgainstDummy: vi.fn(() => Promise.resolve(false)),
  recordFailedAttempt: vi.fn(() => Promise.resolve({ lockedNow: false })),
  recordRejectedLogin: vi.fn(() => Promise.resolve()),
  recordPasswordAccepted: vi.fn(() => Promise.resolve()),
  createStaffSession: vi.fn(() => Promise.resolve("session-id")),
  hashPassword: vi.fn(() => Promise.resolve("rehashed")),
  needsRehash: vi.fn(() => false),
  lockUsableStaff: vi.fn(() => Promise.resolve(true)),
  issueSessionToken: () => ({ token: "t".repeat(43), tokenHash: "h".repeat(64) }),
  inTransaction: (_db: unknown, work: (tx: unknown) => Promise<unknown>) => work({}),
};
vi.mock("@masar/db", () => db);
vi.mock("../db", () => ({ getDb: () => ({}) }));
vi.mock("./club", () => ({ fallbackAuditClubId: () => Promise.resolve(STAFF.clubId) }));
const limits = { allowed: true };
const allowLoginAttempt = vi.fn(() => limits.allowed);
vi.mock("./throttle", () => ({ allowLoginAttempt }));

const { attemptLogin } = await import("./login");

function attempt(overrides: { email?: string; password?: string } = {}) {
  return attemptLogin({
    email: overrides.email ?? " Owner@Example.Test ",
    password: overrides.password ?? "correct horse battery",
    meta: META,
    now: NOW,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  limits.allowed = true;
  db.needsRehash.mockReturnValue(false);
});

describe("attemptLogin", () => {
  it("تجاوز الحد يرفض قبل أي قراءة أو تجزئة، والمفتاح البريد موحَّدًا", async () => {
    limits.allowed = false;
    expect(await attempt()).toBeNull();
    expect(allowLoginAttempt).toHaveBeenCalledWith(META.ip, "owner@example.test");
    expect(db.findStaffCredentialsByEmail).not.toHaveBeenCalled();
    expect(db.verifyAgainstDummy).not.toHaveBeenCalled();
  });

  it("كلمة أطول من الحد تُرفض بلا تجزئة", async () => {
    expect(await attempt({ password: "x".repeat(513) })).toBeNull();
    expect(db.findStaffCredentialsByEmail).not.toHaveBeenCalled();
    expect(db.verifyPassword).not.toHaveBeenCalled();
  });

  it("بريد بلا حساب: تجزئة وهمية وتدقيق بلا بريد، والنتيجة نفسها", async () => {
    db.findStaffCredentialsByEmail.mockResolvedValue(null);
    expect(await attempt()).toBeNull();
    expect(db.verifyAgainstDummy).toHaveBeenCalledOnce();
    expect(db.verifyPassword).not.toHaveBeenCalled();
    expect(db.recordRejectedLogin).toHaveBeenCalledWith(
      {},
      { clubId: STAFF.clubId, staffId: null, reason: "unknown_account", ip: META.ip, at: NOW },
    );
  });

  it("بريد بغير شكله: لا استعلام، وتجزئة وهمية", async () => {
    expect(await attempt({ email: "not an email" })).toBeNull();
    expect(db.findStaffCredentialsByEmail).not.toHaveBeenCalled();
    expect(db.verifyAgainstDummy).toHaveBeenCalledOnce();
  });

  it.each([
    ["معطَّل", { status: "disabled" }, "disabled"],
    ["مقفل", { lockedUntil: new Date(NOW.getTime() + 60_000) }, "locked"],
  ])("حساب %s: لا تُفحص كلمته ولا يُعدّ، وتجزئة وهمية", async (_name, change, reason) => {
    db.findStaffCredentialsByEmail.mockResolvedValue({ ...STAFF, ...change });
    expect(await attempt()).toBeNull();
    expect(db.verifyPassword).not.toHaveBeenCalled();
    expect(db.recordFailedAttempt).not.toHaveBeenCalled();
    expect(db.verifyAgainstDummy).toHaveBeenCalledOnce();
    expect(db.recordRejectedLogin).toHaveBeenCalledWith({}, expect.objectContaining({ reason }));
  });

  it("قفل انتهى موعده لا يمنع", async () => {
    db.findStaffCredentialsByEmail.mockResolvedValue({ ...STAFF, lockedUntil: NOW });
    db.verifyPassword.mockResolvedValue(true);
    expect(await attempt()).not.toBeNull();
  });

  it("كلمة خاطئة: تُعدّ على الحساب ولا جلسة", async () => {
    db.findStaffCredentialsByEmail.mockResolvedValue(STAFF);
    db.verifyPassword.mockResolvedValue(false);
    expect(await attempt()).toBeNull();
    expect(db.recordFailedAttempt).toHaveBeenCalledWith(
      {},
      { staffId: STAFF.id, clubId: STAFF.clubId, ip: META.ip, at: NOW, credential: "password" },
    );
    expect(db.createStaffSession).not.toHaveBeenCalled();
  });

  it("كلمة صحيحة: جلسة برمز جديد قبل الخطوة الثانية وحد مطلق 12 ساعة", async () => {
    db.findStaffCredentialsByEmail.mockResolvedValue(STAFF);
    db.verifyPassword.mockResolvedValue(true);
    const session = await attempt();
    expect(session).toEqual({
      token: "t".repeat(43),
      expiresAt: new Date("2026-11-26T22:00:00Z"),
    });
    expect(db.createStaffSession).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        staffUserId: STAFF.id,
        tokenHash: "h".repeat(64),
        mfaVerifiedAt: null,
        ip: META.ip,
        userAgent: META.userAgent,
      }),
    );
    expect(db.recordPasswordAccepted).toHaveBeenCalledWith(
      {},
      { staffId: STAFF.id, clubId: STAFF.clubId, ip: META.ip, at: NOW },
    );
  });

  it("كلمة صحيحة والحساب قُفل في الأثناء (تحت قفل الصف): لا جلسة ولا تسجيل نجاح", async () => {
    db.findStaffCredentialsByEmail.mockResolvedValue(STAFF);
    db.verifyPassword.mockResolvedValue(true);
    db.lockUsableStaff.mockResolvedValueOnce(false);
    expect(await attempt()).toBeNull();
    expect(db.lockUsableStaff).toHaveBeenCalledWith({}, STAFF.id, NOW);
    expect(db.createStaffSession).not.toHaveBeenCalled();
    expect(db.recordPasswordAccepted).not.toHaveBeenCalled();
  });

  it("الكلمة توحَّد NFKC قبل التحقق، وتُعاد تجزئتها إن كانت بمعاملات أضعف", async () => {
    db.findStaffCredentialsByEmail.mockResolvedValue(STAFF);
    db.verifyPassword.mockResolvedValue(true);
    db.needsRehash.mockReturnValue(true);
    await attempt({ password: "café-table-lamp" });
    expect(db.verifyPassword).toHaveBeenCalledWith("café-table-lamp", STAFF.passwordHash);
    expect(db.hashPassword).toHaveBeenCalledWith("café-table-lamp");
    expect(db.recordPasswordAccepted).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ rehashedPassword: "rehashed" }),
    );
  });
});
