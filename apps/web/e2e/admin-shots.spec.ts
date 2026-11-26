import type { Db } from "@masar/db";
import { createDigitalProgram, insertRawOrder } from "@masar/db/test-support";
import { expect, test, type Page } from "@playwright/test";
import {
  codeFor,
  formAlert,
  newClub,
  newStaff,
  submitLogin,
  submitTotp,
  TEXT,
  withFreshIp,
} from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات حقيقية لكل صفحات اللوحة بمقاس المشروع (390 و1440) للمراجعة البصرية، مع فحص أن لا تمرير
 * أفقي ولا خطأ console (ومنه مخالفات CSP). تُحفظ في apps/web/screens/admin (خارج git).
 */
const SHOTS_DIR = "screens/admin";
const NEW_PASSWORD = "quiet-harbor-lantern-58";
const ORDERS_TODAY = 3;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(message.text());
    }
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

async function shot(page: Page, name: string): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `تمرير أفقي في ${name} عند ${String(width)}`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS_DIR}/${name}-${String(width)}.png`, fullPage: true });
}

test("صفحات ما قبل اللوحة: الدخول، كلمة المرور، التسجيل، رموز الاسترجاع", async ({ page }) => {
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  const staff = await newStaff(db, club, { role: "sales", mustChangePassword: true });
  await withFreshIp(page);

  await page.goto("/admin/login");
  await shot(page, "login");
  await submitLogin(page, staff.email, "wrong-password-entirely");
  await expect(formAlert(page)).toBeVisible();
  await shot(page, "login-error");

  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/password$/);
  await shot(page, "forced-password");
  await page.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: TEXT.forcedPassword.submit }).click();

  await expect(page).toHaveURL(/\/admin\/enrol$/);
  await shot(page, "enrol");
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  const row = await db.staffUser.findUniqueOrThrow({ where: { id: staff.id } });
  expect(row.totpSecretEnc).not.toBeNull();
  const { base32Decode } = await import("@masar/domain");
  const key = base32Decode(secret) ?? new Uint8Array();
  await page.getByLabel(TEXT.enrol.code).fill(codeFor({ ...staff, totpSecret: key }));
  await page.getByRole("button", { name: TEXT.enrol.submit }).click();

  await expect(page).toHaveURL(/\/admin\/recovery-codes$/);
  await shot(page, "recovery-codes");
  expect(problems).toEqual([]);
});

test("اللوحة للمالك: التحقق، النظرة العامة، الموظفون، التدقيق، حسابي", async ({ page }) => {
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" });
  await newStaff(db, club, { role: "manager", withTotp: true, displayName: "سارة الحربي" });
  await newStaff(db, club, { role: "sales", status: "disabled", displayName: "فهد القحطاني" });
  const program = await createDigitalProgram(db, club.id, { priceMinor: 15_000 });
  for (let index = 0; index < ORDERS_TODAY; index += 1) {
    await insertRawOrder(db, {
      clubId: club.id,
      lines: [{ product: program }],
      phone: `+96650000000${String(index)}`,
      createdAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  }

  await withFreshIp(page);
  await submitLogin(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  await shot(page, "verify");
  await page.getByText(TEXT.verify.recoveryTitle).click();
  await shot(page, "verify-recovery");
  await submitTotp(page, codeFor(owner));

  await expect(page.getByRole("heading", { level: 1, name: TEXT.overview.title })).toBeVisible();
  await shot(page, "overview");
  await page.goto("/admin/staff");
  await shot(page, "staff");
  await page.goto("/admin/staff/new");
  await shot(page, "staff-new");
  await page.getByLabel(TEXT.staffNew.name).fill("نورة العتيبي");
  await page.getByLabel(TEXT.staffNew.email).fill(`noura-${String(Date.now())}@example.test`);
  await page.getByRole("button", { name: TEXT.staffNew.submit }).click();
  await expect(page.getByTestId("temporary-password")).toBeVisible();
  await shot(page, "staff-member");
  await page.goto("/admin/audit");
  await shot(page, "audit");
  await page.goto("/admin/account");
  await shot(page, "account");
  expect(problems).toEqual([]);
  // حالة 404 نفسها تُكتب خطأً في console، فتُلتقط بعد فحص الأخطاء
  await page.goto("/admin/no-such-page");
  await shot(page, "not-found");
});
