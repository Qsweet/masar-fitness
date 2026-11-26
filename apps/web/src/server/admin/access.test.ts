import { PERMISSIONS, SESSION_STAGES, STAFF_ROLES, hasPermission } from "@masar/domain";
import { describe, expect, it } from "vitest";
import { ADMIN_ROUTES } from "@/config/admin";
import { ANY_STAGE, decideAccess, isLiveSession, stageOf, STAGE_ROUTES } from "./access";

const NOW = new Date("2026-11-26T10:00:00Z");
const MINUTE_MS = 60_000;

function session(overrides: Partial<Parameters<typeof isLiveSession>[0]> = {}) {
  return {
    lastSeenAt: new Date(NOW.getTime() - MINUTE_MS),
    expiresAt: new Date(NOW.getTime() + 60 * MINUTE_MS),
    revokedAt: null,
    mfaVerifiedAt: NOW,
    ...overrides,
  };
}

const STAFF = {
  role: "owner",
  status: "active",
  totpEnabled: true,
  mustChangePassword: false,
} as const;

describe("قرار الوصول", () => {
  it("لوحة مغلقة ⇒ 404 مهما كانت الجلسة", () => {
    const decision = decideAccess({
      adminEnabled: false,
      current: { role: "owner", stage: "full" },
      permission: "account.self",
      stage: "full",
    });
    expect(decision).toEqual({ kind: "not_found" });
  });

  it("بلا جلسة ⇒ صفحة الدخول", () => {
    const decision = decideAccess({
      adminEnabled: true,
      current: null,
      permission: "account.self",
      stage: "full",
    });
    expect(decision).toEqual({ kind: "redirect", to: ADMIN_ROUTES.login });
  });

  it.each(SESSION_STAGES.filter((stage) => stage !== "full"))(
    "جلسة في مرحلة %s لا تفتح اللوحة: تُحوَّل إلى صفحة مرحلتها",
    (stage) => {
      for (const permission of PERMISSIONS) {
        const decision = decideAccess({
          adminEnabled: true,
          current: { role: "owner", stage },
          permission,
          stage: "full",
        });
        expect(decision).toEqual({ kind: "redirect", to: STAGE_ROUTES[stage] });
      }
    },
  );

  it("صفحة مرحلة لا تُفتح لجلسة في مرحلة أخرى (ولا لجلسة كاملة)", () => {
    for (const pageStage of SESSION_STAGES) {
      for (const stage of SESSION_STAGES.filter((other) => other !== pageStage)) {
        const decision = decideAccess({
          adminEnabled: true,
          current: { role: "owner", stage },
          permission: "account.self",
          stage: pageStage,
        });
        expect(decision).toEqual({ kind: "redirect", to: STAGE_ROUTES[stage] });
      }
    }
  });

  it("جلسة كاملة: السماح يطابق خريطة الصلاحيات، والرفض 404", () => {
    for (const role of STAFF_ROLES) {
      for (const permission of PERMISSIONS) {
        const decision = decideAccess({
          adminEnabled: true,
          current: { role, stage: "full" },
          permission,
          stage: "full",
        });
        expect(decision.kind).toBe(hasPermission(role, permission) ? "allow" : "not_found");
      }
    }
  });

  it("الخروج (any) متاح في كل مرحلة، وليس بلا جلسة", () => {
    for (const stage of SESSION_STAGES) {
      const decision = decideAccess({
        adminEnabled: true,
        current: { role: "sales", stage },
        permission: "account.self",
        stage: ANY_STAGE,
      });
      expect(decision).toEqual({ kind: "allow" });
    }
    const anonymous = decideAccess({
      adminEnabled: true,
      current: null,
      permission: "account.self",
      stage: ANY_STAGE,
    });
    expect(anonymous.kind).toBe("redirect");
  });
});

describe("الجلسة الحيّة", () => {
  it("نشطة لحساب نشط", () => {
    expect(isLiveSession(session(), STAFF, NOW)).toBe(true);
  });

  it.each([
    ["خاملة 30 دقيقة", session({ lastSeenAt: new Date(NOW.getTime() - 30 * MINUTE_MS) })],
    ["بلغت الحد المطلق", session({ expiresAt: NOW })],
    ["ملغاة", session({ revokedAt: NOW })],
  ])("%s ليست جلسة", (_name, dead) => {
    expect(isLiveSession(dead, STAFF, NOW)).toBe(false);
  });

  it("حساب معطَّل لا جلسة له ولو كانت جلسته سليمة", () => {
    expect(isLiveSession(session(), { ...STAFF, status: "disabled" }, NOW)).toBe(false);
  });
});

describe("مرحلة الجلسة من القاعدة", () => {
  it("بلا إثبات الخطوة الثانية ⇒ التحقق؛ ومعه ⇒ كاملة", () => {
    expect(stageOf(session({ mfaVerifiedAt: null }), STAFF)).toBe("mfa_verify");
    expect(stageOf(session(), STAFF)).toBe("full");
  });

  it("كلمة مؤقتة ⇒ تغييرها، وبلا خطوة ثانية ⇒ التسجيل", () => {
    const fresh = { ...STAFF, totpEnabled: false };
    expect(stageOf(session({ mfaVerifiedAt: null }), { ...fresh, mustChangePassword: true })).toBe(
      "password_change",
    );
    expect(stageOf(session({ mfaVerifiedAt: null }), fresh)).toBe("mfa_enrol");
  });
});
