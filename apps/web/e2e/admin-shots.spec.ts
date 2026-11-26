import type { Db } from "@masar/db";
import { createDigitalProgram, insertRawOrder } from "@masar/db/test-support";
import { base32Decode } from "@masar/domain";
import { expect, test, type Page } from "@playwright/test";
import {
  codeFor,
  newClub,
  newStaff,
  setTheme,
  shell,
  submitLogin,
  submitTotp,
  TEXT,
  userMenu,
  withFreshIp,
} from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات حقيقية لكل صفحات اللوحة للمراجعة البصرية: أربعة مقاسات ومظهران، مع فحص أن لا تمرير أفقي ولا
 * خطأ console (ومنه مخالفات CSP). تُحفظ في apps/web/screens/admin (خارج git). الاختبار يغيّر المقاس
 * بنفسه، فيعمل في مشروع واحد.
 */
const SHOTS_DIR = "screens/admin";
const WIDTHS = [390, 768, 1440, 1920] as const;
const THEMES = ["dark", "light"] as const;
const HEIGHT = 900;
const DESKTOP = 1440;
const NEW_PASSWORD = "quiet-harbor-lantern-58";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(({ page }) => {
  test.skip(page.viewportSize()?.width !== DESKTOP, "اللقطات في مشروع واحد: الاختبار يغيّر المقاس");
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

/** الصفحة الحالية بالمظهرين والمقاسات الأربعة. `prepare` يعيد الحالة بعد تبديل المظهر. */
async function shootAll(page: Page, name: string, prepare?: () => Promise<void>): Promise<void> {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await page.reload();
    await prepare?.();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      await shot(page, `${name}-${theme}`);
    }
  }
  await setTheme(page, "dark");
  await page.setViewportSize({ width: DESKTOP, height: HEIGHT });
  await page.reload();
  await prepare?.();
}

async function seedOrders(clubId: string): Promise<void> {
  const program = await createDigitalProgram(db, clubId, { priceMinor: 69_900 });
  const now = Date.now();
  const ages = [0.2, 1.5, 3, 26, 27, 50, 75, 100, 124, 150, 170, 200, 250, 300];
  for (const [index, hours] of ages.entries()) {
    const createdAt = new Date(now - hours * HOUR_MS);
    const order = await insertRawOrder(db, {
      clubId,
      lines: [{ product: program }],
      phone: `+9665000010${String(index).padStart(2, "0")}`,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + (index === 0 ? HOUR_MS : DAY_MS / 48)),
    });
    if (index % 3 === 1) {
      await db.order.update({
        where: { id: order.orderId },
        data: {
          status: "paid",
          paidAt: new Date(createdAt.getTime() + 60_000),
          paidProvider: "fake",
          paidProviderPaymentId: `shot-${order.orderId}`,
          paidAmountMinor: order.totals.totalMinor,
          paidCurrency: "SAR",
        },
      });
    }
  }
}

test("صفحات ما قبل اللوحة بالمظهرين والمقاسات الأربعة", async ({ page }) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  const staff = await newStaff(db, club, { role: "sales", mustChangePassword: true });
  await withFreshIp(page);

  await page.goto("/admin/login");
  await shootAll(page, "login");
  await shootAll(page, "login-error", async () => {
    await submitLogin(page, staff.email, "wrong-password-entirely");
    await expect(page.locator('form [role="alert"]')).toBeVisible();
  });

  await submitLogin(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin\/password$/);
  await shootAll(page, "forced-password");
  await page.getByLabel(TEXT.passwordFields.next).fill(NEW_PASSWORD);
  await page.getByLabel(TEXT.passwordFields.confirmation).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: TEXT.forcedPassword.submit }).click();

  await expect(page).toHaveURL(/\/admin\/enrol$/);
  await shootAll(page, "enrol");
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  const key = base32Decode(secret) ?? new Uint8Array();
  await page.getByLabel(TEXT.enrol.code).fill(codeFor({ ...staff, totpSecret: key }));
  await page.getByRole("button", { name: TEXT.enrol.submit }).click();

  await expect(page).toHaveURL(/\/admin\/recovery-codes$/);
  await shootAll(page, "recovery-codes");
  expect(problems).toEqual([]);
});

test("اللوحة للمالك بالمظهرين والمقاسات الأربعة، والشريط مطويًّا والدرج مفتوحًا", async ({
  page,
}) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" });
  await newStaff(db, club, { role: "manager", withTotp: true, displayName: "سارة الحربي" });
  await newStaff(db, club, { role: "sales", status: "disabled", displayName: "فهد القحطاني" });

  await withFreshIp(page);
  await submitLogin(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  await shootAll(page, "verify", async () => {
    await page.getByText(TEXT.verify.recoveryTitle).click();
  });
  await submitTotp(page, codeFor(owner));
  await expect(shell(page)).toBeVisible();

  await shootAll(page, "overview-empty");
  await seedOrders(club.id);
  await shootAll(page, "overview");

  // الشريط الجانبي مطويًّا، وقائمة الحساب مفتوحة
  await page.getByRole("button", { name: TEXT.shell.collapse }).click();
  await shot(page, "overview-collapsed-dark");
  await page.getByRole("button", { name: TEXT.shell.expand }).click();
  await userMenu(page).click();
  await shot(page, "user-menu-dark");
  await page.keyboard.press("Escape");

  // الدرج الجانبي على الهاتف والجهاز اللوحي
  for (const width of [WIDTHS[0], WIDTHS[1]]) {
    await page.setViewportSize({ width, height: HEIGHT });
    await page.getByRole("button", { name: TEXT.shell.openMenu }).click();
    await expect(page.getByRole("dialog", { name: TEXT.nav.label })).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/drawer-dark-${String(width)}.png` });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: DESKTOP, height: HEIGHT });

  for (const [name, path] of [
    ["staff", "/admin/staff"],
    ["staff-new", "/admin/staff/new"],
    ["audit", "/admin/audit"],
    ["account-password", "/admin/account"],
    ["account-sessions", "/admin/account?tab=sessions"],
  ] as const) {
    await page.goto(path);
    await shootAll(page, name);
  }

  await page.goto("/admin/staff/new");
  await page.getByLabel(TEXT.staffNew.name).fill("نورة العتيبي");
  await page.getByLabel(TEXT.staffNew.email).fill(`noura-${String(Date.now())}@example.test`);
  await page.getByRole("button", { name: TEXT.staffNew.submit }).click();
  await expect(page.getByTestId("temporary-password")).toBeVisible();
  await shootAll(page, "staff-member");
  expect(problems).toEqual([]);
  // حالة 404 نفسها تُكتب خطأً في console، فتُلتقط بعد فحص الأخطاء
  await page.goto("/admin/no-such-page");
  await shootAll(page, "not-found");
});
