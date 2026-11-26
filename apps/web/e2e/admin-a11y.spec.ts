import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { base32Decode } from "@masar/domain";
import { expect, test, type Page } from "@playwright/test";
import {
  codeFor,
  formAlert,
  newClub,
  newStaff,
  signIn,
  submitLogin,
  TEXT,
  withFreshIp,
} from "./admin-support";
import { testDb } from "./payments-support";

/** فحص WCAG 2.2 AA الآلي (axe) لكل صفحة في اللوحة، بمقاسي المشروعين. */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const NEW_PASSWORD = "silver-orchard-compass-36";

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function expectAccessible(page: Page, name: string): Promise<void> {
  // العنوان يصل ببث الصفحة بعد التنقل: ننتظره كي لا يفحص axe مستندًا لم يكتمل
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? "?"}): ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
  expect(summary, name).toEqual([]);
}

test("صفحات ما قبل اللوحة بلا مخالفات وصول آلية", async ({ page }) => {
  const staff = await newStaff(db, await newClub(db), { role: "sales", mustChangePassword: true });
  await withFreshIp(page);
  await page.goto("/admin/login");
  await expectAccessible(page, "login");
  await submitLogin(page, staff.email, "wrong-password-entirely");
  await expect(formAlert(page)).toBeVisible();
  await expectAccessible(page, "login error");

  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/password$/);
  await expectAccessible(page, "forced password");
  await page.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: TEXT.forcedPassword.submit }).click();

  await expect(page).toHaveURL(/\/admin\/enrol$/);
  await expectAccessible(page, "enrol");
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  const key = base32Decode(secret) ?? new Uint8Array();
  await page.getByLabel(TEXT.enrol.code).fill(codeFor({ ...staff, totpSecret: key }));
  await page.getByRole("button", { name: TEXT.enrol.submit }).click();
  await expect(page).toHaveURL(/\/admin\/recovery-codes$/);
  await expectAccessible(page, "recovery codes");
});

test("صفحات اللوحة بلا مخالفات وصول آلية", async ({ page }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const member = await newStaff(db, club, { role: "sales" });
  await withFreshIp(page);
  await submitLogin(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  await page.getByText(TEXT.verify.recoveryTitle).click();
  await expectAccessible(page, "verify");
  await page.context().clearCookies();
  await signIn(page, owner);

  const pages = [
    "/admin",
    "/admin/staff",
    "/admin/staff/new",
    `/admin/staff/${member.id}`,
    `/admin/staff/${owner.id}`,
    "/admin/audit",
    "/admin/audit?actor=provider",
    "/admin/account",
    "/admin/no-such-page",
  ];
  for (const path of pages) {
    await page.goto(path);
    await expectAccessible(page, path);
  }
});

test("لوحة المفاتيح: رابط التخطي أول عنصر في اللوحة ويصل إلى المحتوى", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/account");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: TEXT.skipToContent });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#admin-main$/);
});
