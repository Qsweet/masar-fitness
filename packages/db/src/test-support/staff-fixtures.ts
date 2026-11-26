/** مساعدات اختبار موظفي اللوحة: حساب بكلمة مرور معروفة وتجزئة سريعة، وخطوة ثانية جاهزة عند الطلب. */
import { randomUUID } from "node:crypto";
import { base32Encode, hotp, totpStep, type StaffRole } from "@masar/domain";
import type { Db } from "../client";
import {
  hashPassword,
  hmacSha1,
  newTotpSecret,
  sealSecret,
  type ScryptParams,
} from "../staff/crypto";

/** كلفة منخفضة لتجزئة الاختبار: التحقق يقرأ المعاملات من التجزئة نفسها فيعمل كما في الإنتاج. */
export const TEST_SCRYPT_PARAMS: ScryptParams = { cost: 1024, blockSize: 8, parallelization: 1 };
export const TEST_STAFF_PASSWORD = "walrus-lantern-orbit-42";
/** مفتاح اختبار ثابت (32 بايتًا من الأصفار المرقّمة)، ليس سرًا ولا يُستعمل على خادم. */
export const TEST_ADMIN_KEY = Uint8Array.from({ length: 32 }, (_, index) => index);

const EMAIL_SUFFIX_LENGTH = 10;

export interface TestStaffOptions {
  readonly role?: StaffRole;
  readonly status?: "active" | "disabled";
  readonly mustChangePassword?: boolean;
  /** يفعّل الخطوة الثانية بسر جديد ويرجعه. */
  readonly withTotp?: boolean;
  readonly email?: string;
}

export interface TestStaff {
  readonly id: string;
  readonly clubId: string;
  readonly email: string;
  readonly password: string;
  /** سر TOTP الخام حين `withTotp`؛ وإلا null. */
  readonly totpSecret: Uint8Array | null;
  readonly totpSecretBase32: string | null;
}

export function uniqueStaffEmail(): string {
  const suffix = randomUUID().replaceAll("-", "").slice(0, EMAIL_SUFFIX_LENGTH);
  return `staff-${suffix}@example.test`;
}

/** ينشئ موظفًا مباشرة في القاعدة (بلا تدقيق)، لتجهيز الاختبار لا لاختبار الإنشاء نفسه. */
export async function createTestStaff(
  db: Db,
  clubId: string,
  options: TestStaffOptions = {},
): Promise<TestStaff> {
  const id = randomUUID();
  const email = options.email ?? uniqueStaffEmail();
  const secret = options.withTotp === true ? newTotpSecret() : null;
  await db.staffUser.create({
    data: {
      id,
      clubId,
      email,
      displayName: "موظف اختبار",
      role: options.role ?? "owner",
      status: options.status ?? "active",
      passwordHash: await hashPassword(TEST_STAFF_PASSWORD, TEST_SCRYPT_PARAMS),
      mustChangePassword: options.mustChangePassword ?? false,
      totpSecretEnc: secret === null ? null : sealSecret(TEST_ADMIN_KEY, secret, id),
      totpEnabledAt: secret === null ? null : new Date(),
    },
  });
  return {
    id,
    clubId,
    email,
    password: TEST_STAFF_PASSWORD,
    totpSecret: secret,
    totpSecretBase32: secret === null ? null : base32Encode(secret),
  };
}

/** رمز TOTP الصحيح لسر عند لحظة (افتراضيًا الآن)، مع إزاحة بالخطوات لاختبار النافذة. */
export function totpCodeAt(secret: Uint8Array, nowMs: number = Date.now(), stepOffset = 0): string {
  return hotp(hmacSha1, secret, totpStep(nowMs) + stepOffset);
}
