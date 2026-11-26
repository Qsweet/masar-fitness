import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "./session";

/** فحوص تغيير كلمة المرور قبل الكتابة: الحالية، وحدّ محاولاتها، ورفض الكلمة نفسها. الكتابة مختبرة في المتصفح. */
const NOW = new Date("2026-11-26T10:00:00Z");
const CURRENT = "walrus-lantern-orbit-42";
const NEXT = "copper-meadow-window-71";
const stored = { id: "staff-1", passwordHash: `hash:${CURRENT}` };

const db = {
  findStaffCredentialsById: vi.fn(() => Promise.resolve(stored)),
  verifyPassword: vi.fn((password: string, hash: string) =>
    Promise.resolve(hash === `hash:${password}`),
  ),
  hashPassword: vi.fn((password: string) => Promise.resolve(`hash:${password}`)),
  issueSessionToken: () => ({ token: "t".repeat(43), tokenHash: "h".repeat(64) }),
  rotateStaffSession: vi.fn(() => Promise.resolve("new-session")),
  setStaffPassword: vi.fn(() => Promise.resolve()),
  staffActor: (id: string) => `staff:${id}`,
  inTransaction: (_db: unknown, work: (tx: unknown) => Promise<unknown>) => work({}),
};
vi.mock("@masar/db", () => db);
vi.mock("../db", () => ({ getDb: () => ({}) }));
vi.mock("./club", () => ({ passwordForbiddenWords: () => Promise.resolve([]) }));
const limit = { allowed: true };
const allowCurrentPasswordCheck = vi.fn(() => limit.allowed);
vi.mock("./throttle", () => ({ allowCurrentPasswordCheck }));

const { changeOwnPassword } = await import("./password");

const context = {
  staff: { id: "staff-1", clubId: "club-1", email: "owner@example.test" },
  session: { id: "session-1", expiresAt: NOW },
} as unknown as StaffContext;

function change(overrides: { current?: string | null; next?: string } = {}) {
  const next = overrides.next ?? NEXT;
  return changeOwnPassword({
    context,
    currentPassword: overrides.current === undefined ? CURRENT : overrides.current,
    newPassword: next,
    confirmation: next,
    now: NOW,
  });
}

async function reasonOf(result: ReturnType<typeof change>): Promise<string | null> {
  const settled = await result;
  return settled.ok ? null : settled.error.reason;
}

afterEach(() => {
  vi.clearAllMocks();
  limit.allowed = true;
});

describe("changeOwnPassword", () => {
  it("كلمة جديدة مختلفة مع الحالية الصحيحة تُكتب", async () => {
    expect(await reasonOf(change())).toBeNull();
    expect(db.setStaffPassword).toHaveBeenCalledOnce();
  });

  it("الكلمة الجديدة نفس الحالية مرفوضة في التغيير الاختياري", async () => {
    expect(await reasonOf(change({ next: CURRENT }))).toBe("staff.password_same");
    expect(db.setStaffPassword).not.toHaveBeenCalled();
  });

  it("التغيير الإلزامي لا يقبل الكلمة المؤقتة نفسها", async () => {
    expect(await reasonOf(change({ current: null, next: CURRENT }))).toBe("staff.password_same");
    expect(allowCurrentPasswordCheck).not.toHaveBeenCalled();
    expect(db.setStaffPassword).not.toHaveBeenCalled();
    expect(await reasonOf(change({ current: null }))).toBeNull();
  });

  it("الحالية الخاطئة مرفوضة", async () => {
    expect(await reasonOf(change({ current: "not-my-current-password" }))).toBe(
      "staff.current_password_wrong",
    );
    expect(db.setStaffPassword).not.toHaveBeenCalled();
  });

  it("تجاوز حد محاولات الحالية يرفض بلا تجزئة، ولو كانت صحيحة", async () => {
    limit.allowed = false;
    expect(await reasonOf(change())).toBe("staff.too_many_attempts");
    expect(allowCurrentPasswordCheck).toHaveBeenCalledWith("staff-1");
    expect(db.verifyPassword).not.toHaveBeenCalled();
    expect(db.setStaffPassword).not.toHaveBeenCalled();
  });
});
