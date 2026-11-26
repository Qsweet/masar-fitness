import type { Db } from "@masar/db";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  auditActions,
  codeFor,
  formAlert,
  newClub,
  navLinks,
  newStaff,
  shell,
  signIn,
  signOut,
  submitLogin,
  submitTotp,
  TEXT,
  withFreshIp,
} from "./admin-support";
import { testDb } from "./payments-support";

/** الصلاحيات، وإدارة الموظفين، و«حسابي»، وسجل التدقيق. docs/ADMIN_DESIGN.md §4.7–4.11. */
const NEW_PASSWORD = "copper-meadow-window-71";
const TEMP_PASSWORD = /^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function secondPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await withFreshIp(page);
  return page;
}

test("المالك يرى كل الأقسام، والمدير بلا «الموظفون»، والمبيعات بلا التدقيق", async ({
  browser,
}) => {
  const club = await newClub(db);
  const expected = {
    owner: [TEXT.nav.overview, TEXT.nav.staff, TEXT.nav.audit, TEXT.nav.account],
    manager: [TEXT.nav.overview, TEXT.nav.audit, TEXT.nav.account],
    sales: [TEXT.nav.overview, TEXT.nav.account],
    editor: [TEXT.nav.account],
  } as const;
  for (const role of ["owner", "manager", "sales", "editor"] as const) {
    const staff = await newStaff(db, club, { role, withTotp: true });
    const page = await secondPage(browser);
    await submitLogin(page, staff.email, staff.password);
    await submitTotp(page, codeFor(staff));
    await expect(shell(page)).toBeVisible();
    expect(await navLinks(page)).toEqual(expected[role]);
    await page.context().close();
  }
});

test("دور بلا صلاحية يُرفض بـ404: المبيعات لا تفتح الموظفين ولا التدقيق", async ({ page }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const sales = await newStaff(db, club, { role: "sales", withTotp: true });
  await signIn(page, sales);
  for (const path of [
    "/admin/staff",
    "/admin/staff/new",
    `/admin/staff/${owner.id}`,
    "/admin/audit",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEXT.notFound.title);
  }
  // المحرر لا يرى أرقام المبيعات: يُحوَّل من «نظرة عامة» إلى حسابه
  const editor = await newStaff(db, club, { role: "editor", withTotp: true });
  await signOut(page);
  await signIn(page, editor);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/account$/);
});

test("المالك ينشئ موظفًا بكلمة مؤقتة، والموظف يغيّرها ويسجّل خطوته", async ({ page, browser }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const email = `new-${String(Date.now())}-${String(page.viewportSize()?.width)}@example.test`;
  await signIn(page, owner);
  await page.goto("/admin/staff");
  await page.getByRole("link", { name: TEXT.staff.add }).click();
  await page.getByLabel(TEXT.staffNew.name).fill("ريم الشمري");
  await page.getByLabel(TEXT.staffNew.email).fill(email);
  await page.getByLabel(TEXT.staffNew.role).selectOption("editor");
  await page.getByRole("button", { name: TEXT.staffNew.submit }).click();

  await expect(page.getByRole("status")).toHaveText(TEXT.notices.staff_created);
  const temporary = (await page.getByTestId("temporary-password").textContent()) ?? "";
  expect(temporary).toMatch(TEMP_PASSWORD);
  await page.getByRole("button", { name: TEXT.staffMember.temporaryDismiss }).click();
  await expect(page.getByTestId("temporary-password")).toHaveCount(0);

  const created = await db.staffUser.findUniqueOrThrow({ where: { email } });
  expect(created).toMatchObject({ role: "editor", mustChangePassword: true, clubId: club.id });
  expect(created.passwordHash).not.toContain(temporary);
  expect(await auditActions(db, created.id)).toEqual(["staff_created"]);

  // البريد المستعمل يُرفض
  await page.goto("/admin/staff/new");
  await page.getByLabel(TEXT.staffNew.name).fill("مكرر");
  await page.getByLabel(TEXT.staffNew.email).fill(email);
  await page.getByRole("button", { name: TEXT.staffNew.submit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["staff.email_taken"]);

  const staffPage = await secondPage(browser);
  await submitLogin(staffPage, email, temporary);
  await expect(staffPage).toHaveURL(/\/admin\/password$/);
  await staffPage.goto("/admin/account");
  await expect(staffPage).toHaveURL(/\/admin\/password$/);
  // الكلمة المؤقتة نفسها لا تُقبل كلمةً جديدة
  await staffPage.getByLabel(TEXT.passwordFields.next).fill(temporary);
  await staffPage.getByLabel(TEXT.passwordFields.confirmation).fill(temporary);
  await staffPage.getByRole("button", { name: TEXT.forcedPassword.submit }).click();
  await expect(formAlert(staffPage)).toHaveText(TEXT.errors["staff.password_same"]);
  await staffPage.getByLabel(TEXT.passwordFields.next).fill("password1234");
  await staffPage.getByLabel(TEXT.passwordFields.confirmation).fill("password1234");
  await staffPage.getByRole("button", { name: TEXT.forcedPassword.submit }).click();
  await expect(formAlert(staffPage)).toHaveText(TEXT.errors["staff.password_common"]);
  await staffPage.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await staffPage.getByLabel(TEXT.passwordFields.confirmation).fill(NEW_PASSWORD);
  await staffPage.getByRole("button", { name: TEXT.forcedPassword.submit }).click();
  await expect(staffPage).toHaveURL(/\/admin\/enrol$/);
  await staffPage.context().close();
});

test("تغيير الدور والتعطيل وإعادة الضبط تلغي جلسات الموظف وتُسجَّل", async ({ page, browser }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const member = await newStaff(db, club, { role: "sales", withTotp: true });
  const memberPage = await secondPage(browser);
  await signIn(memberPage, member);

  await signIn(page, owner);
  await page.goto(`/admin/staff/${member.id}`);
  await page.getByLabel(TEXT.staffMember.roleTitle).selectOption("manager");
  await page.getByRole("button", { name: TEXT.staffMember.roleSubmit }).click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.role_changed);
  // جلسة الموظف المفتوحة أُلغيت فورًا
  await memberPage.goto("/admin/account");
  await expect(memberPage).toHaveURL(/\/admin\/login$/);
  await memberPage.context().close();

  await page.getByRole("button", { name: TEXT.staffMember.mfaSubmit }).click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.mfa_reset);
  await page.getByRole("button", { name: TEXT.staffMember.passwordSubmit }).click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.password_reset);
  await expect(page.getByTestId("temporary-password")).toHaveText(TEMP_PASSWORD);
  await page.getByRole("button", { name: TEXT.staffMember.disable }).click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.staff_disabled);

  const row = await db.staffUser.findUniqueOrThrow({ where: { id: member.id } });
  expect(row).toMatchObject({
    role: "manager",
    status: "disabled",
    totpEnabledAt: null,
    totpSecretEnc: null,
    mustChangePassword: true,
  });
  const actions = await auditActions(db, member.id);
  expect(actions.slice(-4)).toEqual([
    "role_changed",
    "mfa_reset",
    "password_reset",
    "staff_disabled",
  ]);

  await page.getByRole("button", { name: TEXT.staffMember.enable }).click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.staff_enabled);
});

test("المالك لا يغيّر حسابه من «الموظفون»، وآخر مالك لا يُنزَّل بطلب مباشر", async ({ page }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  await page.goto(`/admin/staff/${owner.id}`);
  await expect(page.getByText(TEXT.staffMember.selfNote)).toBeVisible();
  await expect(page.getByRole("button", { name: TEXT.staffMember.disable })).toHaveCount(0);
  await expect(page.getByRole("button", { name: TEXT.staffMember.roleSubmit })).toHaveCount(0);

  // موظف من نادٍ آخر غير موجود لهذا المالك
  const foreign = await newStaff(db, await newClub(db), { role: "sales" });
  const response = await page.goto(`/admin/staff/${foreign.id}`);
  expect(response?.status()).toBe(404);
  const row = await db.staffUser.findUniqueOrThrow({ where: { id: owner.id } });
  expect(row).toMatchObject({ role: "owner", status: "active" });
});

test("حسابي: تغيير كلمة المرور بالحالية، وإلغاء جلسة أخرى", async ({ page, browser }) => {
  const staff = await newStaff(db, await newClub(db), { withTotp: true });
  const other = await secondPage(browser);
  await signIn(other, staff);
  await signIn(page, staff, 1);
  await page.goto("/admin/account");
  await page.getByRole("link", { name: TEXT.account.tabs.sessions }).click();
  await expect(page).toHaveURL(/tab=sessions/);
  const rows = page.getByTestId("sessions-table").locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: TEXT.account.current })).toHaveCount(1);

  await rows.filter({ hasNotText: TEXT.account.current }).getByRole("button").click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.session_revoked);
  await expect(rows).toHaveCount(1);
  await other.goto("/admin/account");
  await expect(other).toHaveURL(/\/admin\/login$/);
  await other.context().close();

  await page.getByRole("link", { name: TEXT.account.tabs.password }).click();
  await page.getByLabel(TEXT.passwordFields.current).fill("not-my-current-password");
  await page.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: TEXT.account.passwordSubmit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["staff.current_password_wrong"]);

  await page.getByLabel(TEXT.passwordFields.current).fill(staff.password);
  await page.getByLabel(TEXT.passwordFields.next).fill(staff.password);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(staff.password);
  await page.getByRole("button", { name: TEXT.account.passwordSubmit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["staff.password_same"]);

  await page.getByLabel(TEXT.passwordFields.current).fill(staff.password);
  await page.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(`${NEW_PASSWORD}x`);
  await page.getByRole("button", { name: TEXT.account.passwordSubmit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["staff.password_mismatch"]);

  await page.getByLabel(TEXT.passwordFields.current).fill(staff.password);
  await page.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: TEXT.account.passwordSubmit }).click();
  await expect(page.getByRole("status")).toHaveText(TEXT.notices.password_changed);
  // الجلسة الحالية باقية برمز جديد
  await page.goto("/admin/account");
  await expect(page.getByRole("heading", { level: 1, name: TEXT.account.title })).toBeVisible();
  const actions = await auditActions(db, staff.id);
  expect(actions).toContain("session_revoked");
  expect(actions.at(-1)).toBe("password_changed");
});

test("سجل التدقيق: أحداث الدخول بلا أسرار، والتصفية والصفحات", async ({ page }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "هند المالكة" });
  const extra = Array.from({ length: 30 }, (_, index) => ({
    clubId: club.id,
    entityType: "order",
    entityId: owner.id,
    action: "created",
    actor: "customer",
    createdAt: new Date(Date.now() - (index + 1) * 60_000),
  }));
  await db.auditLog.createMany({ data: extra });
  await signIn(page, owner);
  await page.goto("/admin/audit");
  const table = page.getByTestId("audit-table");
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(table).toContainText(TEXT.audit.actions.login_succeeded);
  await expect(table).toContainText(TEXT.audit.actions.mfa_verified);
  await expect(table).toContainText("هند المالكة");
  await expect(page.getByTestId("audit-range")).toHaveText("1 إلى 25 من 32");
  const html = await page.content();
  expect(html).not.toContain(owner.password);
  expect(html).not.toContain(owner.totpSecretBase32 ?? "-");

  await page.getByRole("link", { name: TEXT.audit.older }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(table.locator("tbody tr")).toHaveCount(7);

  await page.getByLabel(TEXT.audit.filters.actor).selectOption("staff");
  await page.getByRole("button", { name: TEXT.audit.filters.apply }).click();
  await expect(page).toHaveURL(/actor=staff/);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel(TEXT.audit.filters.entity).selectOption("refund");
  await page.getByRole("button", { name: TEXT.audit.filters.apply }).click();
  await expect(page.getByText(TEXT.audit.emptyTitle)).toBeVisible();
  await page.getByRole("link", { name: TEXT.audit.filters.clear }).click();
  await expect(table.locator("tbody tr")).toHaveCount(25);
});
