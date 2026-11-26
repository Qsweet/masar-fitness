import { describe, expect, it } from "vitest";
import {
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  sessionExpiry,
  sessionStage,
  sessionStatus,
} from "./session";

const LOGIN = new Date("2026-11-26T08:00:00Z");

function session(lastSeenOffsetMs: number, revokedAt: Date | null = null) {
  return {
    lastSeenAt: new Date(LOGIN.getTime() + lastSeenOffsetMs),
    expiresAt: sessionExpiry(LOGIN),
    revokedAt,
  };
}

describe("عمر الجلسة", () => {
  it("الحد المطلق 12 ساعة من الدخول", () => {
    expect(sessionExpiry(LOGIN)).toEqual(new Date("2026-11-26T20:00:00Z"));
  });

  it("نشطة قبل 30 دقيقة من آخر نشاط", () => {
    const now = new Date(LOGIN.getTime() + SESSION_IDLE_MS - 1);
    expect(sessionStatus(session(0), now)).toBe("active");
  });

  it("خاملة عند 30 دقيقة تمامًا", () => {
    const now = new Date(LOGIN.getTime() + SESSION_IDLE_MS);
    expect(sessionStatus(session(0), now)).toBe("idle");
  });

  it("منتهية عند الحد المطلق ولو كانت نشطة للتو", () => {
    const now = new Date(LOGIN.getTime() + SESSION_ABSOLUTE_MS);
    expect(sessionStatus(session(SESSION_ABSOLUTE_MS - 1), now)).toBe("expired");
  });

  it("الملغاة ملغاة مهما كان وقتها", () => {
    expect(sessionStatus(session(0, LOGIN), LOGIN)).toBe("revoked");
  });
});

describe("مرحلة الجلسة", () => {
  it.each([
    [{ totpEnabled: true, mfaVerified: false, mustChangePassword: false }, "mfa_verify"],
    [{ totpEnabled: true, mfaVerified: false, mustChangePassword: true }, "mfa_verify"],
    [{ totpEnabled: true, mfaVerified: true, mustChangePassword: true }, "password_change"],
    [{ totpEnabled: false, mfaVerified: false, mustChangePassword: true }, "password_change"],
    [{ totpEnabled: false, mfaVerified: false, mustChangePassword: false }, "mfa_enrol"],
    [{ totpEnabled: false, mfaVerified: true, mustChangePassword: false }, "mfa_enrol"],
    [{ totpEnabled: true, mfaVerified: true, mustChangePassword: false }, "full"],
  ] as const)("%o ← %s", (input, stage) => {
    expect(sessionStage(input)).toBe(stage);
  });

  it("لا طريق إلى اللوحة بلا خطوة ثانية مثبتة", () => {
    for (const totpEnabled of [true, false]) {
      for (const mustChangePassword of [true, false]) {
        const stage = sessionStage({ totpEnabled, mfaVerified: false, mustChangePassword });
        expect(stage).not.toBe("full");
      }
    }
  });
});
