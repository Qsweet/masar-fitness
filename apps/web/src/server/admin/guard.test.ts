import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffContext } from "./session";

const NOT_FOUND = "NEXT_NOT_FOUND";
const REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  redirect: (path: string) => {
    throw new Error(`${REDIRECT} ${path}`);
  },
}));
const state: { enabled: boolean; current: StaffContext | null } = { enabled: true, current: null };
vi.mock("./flag", () => ({ isAdminEnabled: () => state.enabled }));
const currentStaffSession = vi.fn(() => Promise.resolve(state.current));
vi.mock("./session", () => ({ currentStaffSession }));

const { requireStaff } = await import("./guard");

function context(role: StaffContext["staff"]["role"], stage: StaffContext["stage"]): StaffContext {
  const at = new Date("2026-11-26T10:00:00Z");
  return {
    staff: {
      id: "018f4e2a-0000-7000-8000-000000000001",
      clubId: "018f4e2a-0000-7000-8000-000000000002",
      email: "staff@example.test",
      displayName: "موظف",
      role,
      status: "active",
      mustChangePassword: false,
      totpEnabled: true,
      lockedUntil: null,
      lastLoginAt: at,
      createdAt: at,
    },
    session: {
      id: "018f4e2a-0000-7000-8000-000000000003",
      staffUserId: "018f4e2a-0000-7000-8000-000000000001",
      createdAt: at,
      lastSeenAt: at,
      expiresAt: at,
      mfaVerifiedAt: at,
      revokedAt: null,
      ip: "10.0.0.1",
      userAgent: "test",
    },
    stage,
  };
}

afterEach(() => {
  state.enabled = true;
  state.current = null;
  currentStaffSession.mockClear();
});

describe("requireStaff", () => {
  it("لوحة مغلقة ⇒ 404 بلا أي قراءة للجلسة", async () => {
    state.enabled = false;
    state.current = context("owner", "full");
    await expect(requireStaff("account.self")).rejects.toThrow(NOT_FOUND);
    expect(currentStaffSession).not.toHaveBeenCalled();
  });

  it("بلا جلسة ⇒ تحويل إلى الدخول", async () => {
    await expect(requireStaff("account.self")).rejects.toThrow(`${REDIRECT} /admin/login`);
  });

  it("جلسة قبل الخطوة الثانية ⇒ تحويل إلى التحقق، لا إلى الصفحة المطلوبة", async () => {
    state.current = context("owner", "mfa_verify");
    await expect(requireStaff("staff.manage")).rejects.toThrow(`${REDIRECT} /admin/verify`);
  });

  it("دور بلا الصلاحية ⇒ 404", async () => {
    state.current = context("sales", "full");
    await expect(requireStaff("staff.manage")).rejects.toThrow(NOT_FOUND);
    await expect(requireStaff("audit.read")).rejects.toThrow(NOT_FOUND);
  });

  it("دور بالصلاحية ⇒ يرجع سياق الجلسة", async () => {
    state.current = context("owner", "full");
    await expect(requireStaff("staff.manage")).resolves.toBe(state.current);
  });

  it("صفحة مرحلة تقبل جلسة في مرحلتها فقط", async () => {
    state.current = context("editor", "mfa_enrol");
    await expect(requireStaff("account.self", "mfa_enrol")).resolves.toBe(state.current);
    await expect(requireStaff("account.self", "mfa_verify")).rejects.toThrow(
      `${REDIRECT} /admin/enrol`,
    );
  });
});
