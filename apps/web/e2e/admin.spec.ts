import {
  createStaffSession,
  issueRecoveryCodes,
  issueSessionToken,
  touchStaffSession,
  type Db,
} from "@masar/db";
import { base32Decode, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, sessionExpiry } from "@masar/domain";
import type { TestStaff } from "@masar/db/test-support";
import { expect, test, type Page } from "@playwright/test";
import {
  addRecoveryCode,
  auditActions,
  codeFor,
  formAlert,
  newClub,
  newStaff,
  SESSION_COOKIE,
  shell,
  signIn,
  signOut,
  submitLogin,
  submitTotp,
  TEXT,
  withFreshIp,
} from "./admin-support";
import { testDb } from "./payments-support";

/** الدخول والخطوة الثانية والجلسات على خادم اللوحة (المفتاح مضبوط). docs/ADMIN_DESIGN.md §4.11. */
const LOGIN_FAILED = TEXT.errors["staff.login_failed"];
const MFA_FAILED = TEXT.errors["staff.mfa_failed"];
const MINUTE_MS = 60_000;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await withFreshIp(page);
});

async function sessionCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === SESSION_COOKIE)?.value ?? "";
}

test("ترويسات اللوحة: لا فهرسة، لا تخزين، سياسة أمان المحتوى، وكوكي الجلسة محصَّن", async ({
  page,
  request,
}) => {
  const login = await request.get("/admin/login");
  expect(login.status()).toBe(200);
  expect(login.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(login.headers()["cache-control"]).toContain("no-store");
  expect(login.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(await login.text()).toContain('name="robots" content="noindex, nofollow"');

  // اللوحة مفتوحة: robots.txt يمنع زحفها، وكتابة أخرى لاسمها 404 عامة لا صفحة دخول
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  for (const path of ["/Admin/login", "/%61dmin/login"]) {
    const lookalike = await request.get(path, { maxRedirects: 0 });
    expect(lookalike.status()).toBe(404);
    expect(await lookalike.text()).not.toContain('type="password"');
  }

  const gated = await request.get("/admin", { maxRedirects: 0 });
  expect(gated.status()).toBe(307);
  expect(gated.headers().location).toBe("/admin/login");
  expect(gated.headers()["cache-control"]).toContain("no-store");

  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  const cookie = (await page.context().cookies()).find((entry) => entry.name === SESSION_COOKIE);
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });
  expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test("أول دخول: تسجيل الخطوة الثانية ثم رموز الاسترجاع ثم اللوحة", async ({ page }) => {
  const staff = await newStaff(db, await newClub(db));
  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/enrol$/);
  await expect(page.getByRole("img", { name: TEXT.enrol.qrAlt })).toBeVisible();
  const beforeEnrol = await sessionCookie(page);

  // تحديث الصفحة لا يغيّر السر المعلّق (رمز مُسح للتو يبقى صالحًا)
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  await page.reload();
  await expect(page.getByTestId("totp-secret")).toHaveText(secret);

  await page.getByLabel(TEXT.enrol.code).fill("000000");
  await page.getByRole("button", { name: TEXT.enrol.submit }).click();
  await expect(formAlert(page)).toHaveText(MFA_FAILED);

  const key = base32Decode(secret) ?? new Uint8Array();
  const enrolled: TestStaff = { ...staff, totpSecret: key };
  await page.getByLabel(TEXT.enrol.code).fill(codeFor(enrolled));
  await page.getByRole("button", { name: TEXT.enrol.submit }).click();

  await expect(page).toHaveURL(/\/admin\/recovery-codes$/);
  const codes = await page.getByTestId("recovery-code").allTextContents();
  expect(codes).toHaveLength(10);
  expect(new Set(codes).size).toBe(10);
  // رمز الجلسة تغيّر عند إتمام الخطوة الثانية
  expect(await sessionCookie(page)).not.toBe(beforeEnrol);

  await page.getByRole("button", { name: TEXT.recoveryCodes.confirm }).click();
  await expect(page.getByRole("heading", { level: 1, name: TEXT.overview.title })).toBeVisible();
  // الرموز لا تُعرض ثانية
  await page.goto("/admin/recovery-codes");
  await expect(page).toHaveURL(/\/admin$/);

  const row = await db.staffUser.findUniqueOrThrow({ where: { id: staff.id } });
  expect(row.totpEnabledAt).not.toBeNull();
  expect(row.totpSecretEnc).not.toContain(secret.replaceAll(" ", ""));
  expect(await db.staffRecoveryCode.count({ where: { staffUserId: staff.id } })).toBe(10);
  expect(await auditActions(db, staff.id)).toEqual(["login_succeeded", "mfa_enrolled"]);
});

test("فشل الدخول برسالة واحدة: بريد مجهول، كلمة خاطئة، حساب معطَّل", async ({ page }) => {
  const club = await newClub(db);
  const staff = await newStaff(db, club, { withTotp: true });
  const disabled = await newStaff(db, club, { role: "sales", status: "disabled" });
  const attempts: [string, string][] = [
    ["nobody@example.test", staff.password],
    [staff.email, "not-the-right-password"],
    [disabled.email, disabled.password],
    ["not an email", "whatever-password-1"],
  ];
  for (const [email, password] of attempts) {
    await page.goto("/admin/login");
    await page.getByLabel(TEXT.login.email).fill(email);
    await page.getByLabel(TEXT.login.password).fill(password);
    // Enter: إرسال ضمني حقيقي بلا فحص المتصفح لشكل البريد
    await page.getByLabel(TEXT.login.email).evaluate((input: HTMLInputElement) => {
      input.type = "text";
    });
    await page.getByLabel(TEXT.login.password).press("Enter");
    await expect(formAlert(page)).toHaveText(LOGIN_FAILED);
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(await sessionCookie(page)).toBe("");
  }
  expect(await auditActions(db, staff.id)).toEqual(["login_failed"]);
  expect(await auditActions(db, disabled.id)).toEqual(["login_failed"]);
});

test("خمس محاولات خاطئة تقفل الحساب، والكلمة الصحيحة لا تدخل أثناء القفل", async ({ page }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await submitLogin(page, staff.email, "wrong-password-attempt");
    await expect(formAlert(page)).toHaveText(LOGIN_FAILED);
  }
  const row = await db.staffUser.findUniqueOrThrow({ where: { id: staff.id } });
  expect(row.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 14 * MINUTE_MS);

  await submitLogin(page, staff.email, staff.password);
  await expect(formAlert(page)).toHaveText(LOGIN_FAILED);
  const actions = await auditActions(db, staff.id);
  expect(actions.filter((action) => action === "login_failed")).toHaveLength(6);
  expect(actions.filter((action) => action === "account_locked")).toHaveLength(1);
  expect(actions).not.toContain("login_succeeded");
});

test("الخطوة الثانية: رمز خاطئ يُرفض، والصحيح يدخل، والمستعمل لا يُقبل ثانية", async ({ page }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  const beforeVerify = await sessionCookie(page);
  const code = codeFor(staff);
  await submitTotp(page, code === "000000" ? "000001" : "000000");
  await expect(formAlert(page)).toHaveText(MFA_FAILED);

  await submitTotp(page, code);
  await expect(page.getByRole("heading", { level: 1, name: TEXT.overview.title })).toBeVisible();
  expect(await sessionCookie(page)).not.toBe(beforeVerify);

  await signOut(page);
  await submitLogin(page, staff.email, staff.password);
  await submitTotp(page, code);
  await expect(formAlert(page)).toHaveText(MFA_FAILED);
  await submitTotp(page, codeFor(staff, 1));
  await expect(page.getByRole("heading", { level: 1, name: TEXT.overview.title })).toBeVisible();

  const actions = await auditActions(db, staff.id);
  expect(actions.filter((action) => action === "mfa_failed")).toHaveLength(2);
  expect(actions.filter((action) => action === "mfa_verified")).toHaveLength(2);
  expect(actions).toContain("logout");
});

test("رمز الاسترجاع يدخل مرة واحدة فقط", async ({ page }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  // رمز عشوائي لكل تشغيل: تجزئة الرمز فريدة في القاعدة كلها
  const [recoveryCode = ""] = issueRecoveryCodes().codes;
  await addRecoveryCode(db, staff, recoveryCode);
  const useRecovery = async () => {
    await submitLogin(page, staff.email, staff.password);
    await page.getByText(TEXT.verify.recoveryTitle).click();
    await page.getByLabel(TEXT.verify.recoveryCode).fill(recoveryCode.toLowerCase());
    await page.getByRole("button", { name: TEXT.verify.recoverySubmit }).click();
  };
  await useRecovery();
  await expect(page.getByRole("heading", { level: 1, name: TEXT.overview.title })).toBeVisible();
  await signOut(page);

  await useRecovery();
  await expect(formAlert(page)).toHaveText(MFA_FAILED);
  const actions = await auditActions(db, staff.id);
  expect(actions.filter((action) => action === "recovery_code_used")).toHaveLength(1);
});

test("جلسة قبل الخطوة الثانية لا تفتح إلا صفحة التحقق", async ({ page }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  for (const path of ["/admin", "/admin/staff", "/admin/audit", "/admin/account", "/admin/enrol"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/verify$/);
  }
  // الخروج متاح قبل إتمام الخطوة
  await signOut(page);
});

test("الخروج يلغي الجلسة: الكوكي القديم لا يعمل بعده", async ({ page, baseURL }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, staff);
  const token = await sessionCookie(page);
  await signOut(page);
  expect(await sessionCookie(page)).toBe("");

  await page.context().addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL ?? "" }]);
  await page.goto("/admin/account");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("الجلسة تنتهي بالخمول 30 دقيقة وبالحد المطلق 12 ساعة", async ({ page, baseURL }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  const open = async (startedAgoMs: number, seenNow: boolean) => {
    const issued = issueSessionToken();
    const startedAt = new Date(Date.now() - startedAgoMs);
    const id = await createStaffSession(db, {
      staffUserId: staff.id,
      tokenHash: issued.tokenHash,
      now: startedAt,
      expiresAt: sessionExpiry(startedAt),
      mfaVerifiedAt: startedAt,
      ip: "10.0.0.1",
      userAgent: "e2e",
    });
    if (seenNow) {
      await touchStaffSession(db, id, new Date());
    }
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([{ name: SESSION_COOKIE, value: issued.token, url: baseURL ?? "" }]);
    await page.goto("/admin/account");
  };

  await open(SESSION_IDLE_MS - 5 * MINUTE_MS, false);
  await expect(page.getByRole("heading", { level: 1, name: TEXT.account.title })).toBeVisible();
  await open(SESSION_IDLE_MS + MINUTE_MS, false);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await open(SESSION_ABSOLUTE_MS + MINUTE_MS, true);
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("صفحة مجهولة داخل اللوحة: 404 داخل الهيكل، وبلا جلسة تحويل إلى الدخول", async ({ page }) => {
  await page.goto("/admin/no-such-page");
  await expect(page).toHaveURL(/\/admin\/login$/);
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, staff);
  const response = await page.goto("/admin/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEXT.notFound.title);
  await expect(shell(page)).toBeVisible();
});
