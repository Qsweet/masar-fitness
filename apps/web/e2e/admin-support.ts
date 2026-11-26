import { normalizeRecoveryCode, recoveryCodeHash, type Db } from "@masar/db";
import {
  createTestClub,
  createTestStaff,
  totpCodeAt,
  type TestStaff,
  type TestStaffOptions,
} from "@masar/db/test-support";
import { expect, type Locator, type Page } from "@playwright/test";
import { adminAr } from "../src/i18n/admin/ar";
import { randomIp } from "./payments-support";

/**
 * عدّة اختبارات لوحة التحكم في المتصفح. كل اختبار ينشئ ناديًا وموظفيه في قاعدة الاختبار التي يعمل
 * عليها الخادم، فلا تتداخل الاختبارات المتوازية (قاعدة «آخر مالك» لكل نادٍ). النصوص من القاموس نفسه.
 */
export const TEXT = adminAr;
export const LOGIN_PATH = "/admin/login";
export const SESSION_COOKIE = "masar_admin";

/** رسالة خطأ النموذج (لا معلِن المسارات الذي يضعه Next بالدور نفسه). */
export function formAlert(page: Page): Locator {
  return page.locator('form [role="alert"]');
}

export interface Club {
  readonly id: string;
}

export async function newClub(db: Db): Promise<Club> {
  return { id: await createTestClub(db) };
}

export function newStaff(db: Db, club: Club, options: TestStaffOptions = {}): Promise<TestStaff> {
  return createTestStaff(db, club.id, options);
}

/** عنوان عشوائي لكل اختبار، فحدود المحاولات لكل عنوان لا تتراكم بين الاختبارات. */
export async function withFreshIp(page: Page): Promise<void> {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
}

export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel(TEXT.login.email).fill(email);
  await page.getByLabel(TEXT.login.password).fill(password);
  await page.getByRole("button", { name: TEXT.login.submit }).click();
}

/** رمز الخطوة الحالية؛ `stepOffset` 1 لدخول ثانٍ في الاختبار نفسه (الرمز المستعمل لا يُقبل ثانية). */
export function codeFor(staff: TestStaff, stepOffset = 0): string {
  if (staff.totpSecret === null) {
    throw new Error("الموظف بلا خطوة ثانية: أنشئه بـwithTotp");
  }
  return totpCodeAt(staff.totpSecret, Date.now(), stepOffset);
}

export async function submitTotp(page: Page, code: string): Promise<void> {
  await page.getByLabel(TEXT.verify.code).fill(code);
  await page.getByRole("button", { name: TEXT.verify.submit, exact: true }).click();
}

/** دخول كامل لموظف له خطوة ثانية: كلمة المرور ثم رمز التطبيق، حتى تظهر اللوحة. */
export async function signIn(page: Page, staff: TestStaff, stepOffset = 0): Promise<void> {
  await withFreshIp(page);
  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  await submitTotp(page, codeFor(staff, stepOffset));
  await expect(page.getByRole("navigation", { name: TEXT.nav.label })).toBeVisible();
}

/** يخرج وينتظر صفحة الدخول: دخول تالٍ قبل اكتمال الخروج يجد الجلسة القديمة حيّة فيُحوَّل. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: TEXT.nav.logout }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
}

/** يضيف رمز استرجاع معروفًا للموظف (مجزأً كما يخزّنه التسجيل). */
export async function addRecoveryCode(db: Db, staff: TestStaff, code: string): Promise<void> {
  const normalized = normalizeRecoveryCode(code);
  if (normalized === null) {
    throw new Error("رمز استرجاع بغير شكله");
  }
  await db.staffRecoveryCode.create({
    data: { staffUserId: staff.id, codeHash: recoveryCodeHash(normalized) },
  });
}

export function auditActions(db: Db, staffId: string): Promise<string[]> {
  return db.auditLog
    .findMany({ where: { entityId: staffId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    .then((rows) => rows.map((row) => row.action));
}
