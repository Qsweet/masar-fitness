import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_CURRENT_PASSWORD_CHECKS_PER_STAFF,
  MAX_LOGIN_ATTEMPTS_PER_EMAIL,
  MAX_LOGIN_ATTEMPTS_PER_IP,
  MAX_MANUAL_SETTLE_ATTEMPTS_PER_STAFF,
  MAX_MFA_ATTEMPTS_PER_IP,
  MAX_MFA_ATTEMPTS_PER_STAFF,
  MAX_PHONE_LOOKUPS_PER_STAFF,
  MAX_PHONE_REVEALS_PER_STAFF,
} from "@/config/admin";
import {
  allowCurrentPasswordCheck,
  allowLoginAttempt,
  allowManualSettle,
  allowMfaAttempt,
  allowPhoneLookup,
  allowPhoneReveal,
} from "./throttle";

const VICTIM = "owner@example.test";
const ATTACKER_IP = "198.51.100.9";

beforeEach(() => {
  // المحدِّدات على globalThis: كل اختبار يبدأ بنوافذ فارغة
  Reflect.deleteProperty(globalThis, "masarAdminLimiters");
});

function exhaustIp(ip: string): void {
  for (let index = 0; index < MAX_LOGIN_ATTEMPTS_PER_IP; index += 1) {
    expect(allowLoginAttempt(ip, `filler-${String(index)}@example.test`)).toBe(true);
  }
}

describe("حدود محاولات اللوحة", () => {
  it("عنوان تجاوز حدّه لا يستهلك من نافذة بريد الضحية", () => {
    exhaustIp(ATTACKER_IP);
    for (let index = 0; index < MAX_LOGIN_ATTEMPTS_PER_EMAIL * 2; index += 1) {
      expect(allowLoginAttempt(ATTACKER_IP, VICTIM)).toBe(false);
    }
    // نافذة بريد الضحية كاملة لمن يدخل من عناوين أخرى
    for (let index = 0; index < MAX_LOGIN_ATTEMPTS_PER_EMAIL; index += 1) {
      expect(allowLoginAttempt(`203.0.113.${String(index)}`, VICTIM)).toBe(true);
    }
    expect(allowLoginAttempt("203.0.113.200", VICTIM)).toBe(false);
  });

  it("حد البريد يسري من أي عنوان", () => {
    for (let index = 0; index < MAX_LOGIN_ATTEMPTS_PER_EMAIL; index += 1) {
      expect(allowLoginAttempt(`203.0.113.${String(index)}`, VICTIM)).toBe(true);
    }
    expect(allowLoginAttempt("203.0.113.99", VICTIM)).toBe(false);
    expect(allowLoginAttempt("203.0.113.99", "other@example.test")).toBe(true);
  });

  it("الخطوة الثانية: حد مستقل للحساب وللعنوان، والعنوان المرفوض لا يستهلك من الحساب", () => {
    for (let index = 0; index < MAX_MFA_ATTEMPTS_PER_IP; index += 1) {
      expect(allowMfaAttempt(ATTACKER_IP, `staff-${String(index)}`)).toBe(true);
    }
    expect(allowMfaAttempt(ATTACKER_IP, "victim")).toBe(false);
    for (let index = 0; index < MAX_MFA_ATTEMPTS_PER_STAFF; index += 1) {
      expect(allowMfaAttempt(`203.0.113.${String(index)}`, "victim")).toBe(true);
    }
    expect(allowMfaAttempt("203.0.113.77", "victim")).toBe(false);
    // حد الدخول لم يُمسّ
    expect(allowLoginAttempt("203.0.113.77", VICTIM)).toBe(true);
  });

  it("فحص كلمة المرور الحالية محدود لكل حساب", () => {
    for (let index = 0; index < MAX_CURRENT_PASSWORD_CHECKS_PER_STAFF; index += 1) {
      expect(allowCurrentPasswordCheck("staff-a")).toBe(true);
    }
    expect(allowCurrentPasswordCheck("staff-a")).toBe(false);
    expect(allowCurrentPasswordCheck("staff-b")).toBe(true);
  });
});

describe("حدود إجراءات المبيعات لكل موظف", () => {
  it.each([
    ["البحث بالجوال", allowPhoneLookup, MAX_PHONE_LOOKUPS_PER_STAFF, 20],
    ["كشف الجوال", allowPhoneReveal, MAX_PHONE_REVEALS_PER_STAFF, 30],
    ["الدفع اليدوي", allowManualSettle, MAX_MANUAL_SETTLE_ATTEMPTS_PER_STAFF, 10],
  ] as const)("%s: الحد في عشر دقائق، وكل موظف بنافذته", (_name, allow, limit, expected) => {
    expect(limit).toBe(expected);
    for (let index = 0; index < limit; index += 1) {
      expect(allow("staff-a")).toBe(true);
    }
    expect(allow("staff-a")).toBe(false);
    expect(allow("staff-b")).toBe(true);
  });

  it("الحدود الثلاثة مستقلة: استنفاد الكشف لا يمنع البحث ولا الدفع", () => {
    for (let index = 0; index < MAX_PHONE_REVEALS_PER_STAFF; index += 1) {
      allowPhoneReveal("staff-a");
    }
    expect(allowPhoneReveal("staff-a")).toBe(false);
    expect(allowPhoneLookup("staff-a")).toBe(true);
    expect(allowManualSettle("staff-a")).toBe(true);
  });
});
