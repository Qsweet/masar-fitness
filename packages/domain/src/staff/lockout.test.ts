import { describe, expect, it } from "vitest";
import {
  afterFailedLogin,
  CLEARED_LOGIN_GUARD,
  isLockedOut,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  type LoginGuardState,
} from "./lockout";

const NOW = new Date("2026-11-26T10:00:00Z");
const MINUTE_MS = 60_000;

describe("قفل الحساب", () => {
  it("أربع محاولات فاشلة لا تقفل", () => {
    let state: LoginGuardState = CLEARED_LOGIN_GUARD;
    for (let attempt = 1; attempt < MAX_FAILED_LOGINS; attempt += 1) {
      const outcome = afterFailedLogin(state, NOW);
      expect(outcome).toEqual({ failedLogins: attempt, lockedUntil: null, lockedNow: false });
      state = outcome;
    }
    expect(isLockedOut(state, NOW)).toBe(false);
  });

  it("الخامسة المتتالية تقفل 15 دقيقة وتصفّر العدّاد", () => {
    const outcome = afterFailedLogin(
      { failedLogins: MAX_FAILED_LOGINS - 1, lockedUntil: null },
      NOW,
    );
    expect(outcome.lockedNow).toBe(true);
    expect(outcome.failedLogins).toBe(0);
    expect(outcome.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_MINUTES * MINUTE_MS));
    expect(isLockedOut(outcome, NOW)).toBe(true);
  });

  it("القفل ينتهي عند موعده تمامًا", () => {
    const lockedUntil = new Date(NOW.getTime() + LOCKOUT_MINUTES * MINUTE_MS);
    const state = { failedLogins: 0, lockedUntil };
    expect(isLockedOut(state, new Date(lockedUntil.getTime() - 1))).toBe(true);
    expect(isLockedOut(state, lockedUntil)).toBe(false);
  });

  it("بعد انتهاء القفل تبدأ خمس محاولات جديدة", () => {
    const expired = { failedLogins: 0, lockedUntil: new Date(NOW.getTime() - 1) };
    const outcome = afterFailedLogin(expired, NOW);
    expect(outcome).toEqual({ failedLogins: 1, lockedUntil: null, lockedNow: false });
  });

  it("الدخول الناجح يصفّر الحالة", () => {
    expect(CLEARED_LOGIN_GUARD).toEqual({ failedLogins: 0, lockedUntil: null });
  });
});
