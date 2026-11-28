import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { formAlert, newClub, newStaff, setTheme, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * «الربط والقياس» (ADMIN_A5_TRACKING §8) على نادي اختبار (لا نادي الموقع): الحفظ والتحقق، والمفتاح
 * للكتابة فقط، وحدث الاختبار بالناقل الوهمي (الخادم بـTRACKING_TRANSPORT=fake: لا شبكة)، والسجل،
 * والصلاحيات. لقطات الصفحة في screens/tracking.
 */
const TEXTS = TEXT.integrations;
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SECRET = "EAAB-e2e-server-token-9Q7Z";
const SHOTS_DIR = "screens/tracking";

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function expectAccessible(page: Page, name: string): Promise<void> {
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
    ),
    name,
  ).toEqual([]);
}

async function openMeta(page: Page): Promise<void> {
  await page.goto("/admin/integrations");
  await page
    .getByRole("link", { name: `${TEXTS.form.title}: ${TEXTS.providers.meta.name}` })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: TEXTS.providers.meta.name }),
  ).toBeVisible();
}

async function saveMeta(page: Page, pixel: string): Promise<void> {
  await page.getByLabel(TEXTS.form.enabled, { exact: true }).check();
  await page.getByLabel(TEXTS.form.fields.pixelId.label).fill(pixel);
  await page.getByLabel(TEXTS.form.testEventCode).fill("TEST4242");
  await page.getByLabel(TEXTS.form.secret).fill(SECRET);
  await page.getByRole("button", { name: TEXTS.form.submit }).click();
}

test("المالك يفعّل ميتا: نمط المعرّف، والمفتاح للكتابة فقط، وحدث الاختبار في السجل، والتدقيق", async ({
  page,
}, testInfo) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/integrations");
  await expect(page.getByTestId("provider-tiles").getByRole("listitem")).toHaveCount(7);

  await openMeta(page);
  await saveMeta(page, "12ab");
  await expect(formAlert(page)).toHaveText(TEXT.errors["tracking.invalid_pixelId"]);
  await saveMeta(page, "123456789012345");
  await expect(page.getByText(TEXT.notices.tracking_saved)).toBeVisible();
  // لا يرجع المفتاح إلى الصفحة: الحقل فارغ، وآخر أربعة وحدها
  await expect(page.getByLabel(TEXTS.form.secret)).toHaveValue("");
  await expect(page.getByText(/آخره 9Q7Z/)).toBeVisible();
  expect(await page.content()).not.toContain(SECRET);

  await page.getByRole("button", { name: TEXTS.test.submit }).click();
  await expect(page.getByText(TEXT.notices.tracking_test_sent)).toBeVisible();
  const log = page.getByTestId("tracking-log");
  await expect(log.getByText("MasarTestEvent")).toBeVisible();
  await expect(log.getByText(TEXTS.log.statuses.sent)).toBeVisible();
  const audit = await db.auditLog.findMany({
    where: { clubId: club.id, entityType: "tracking_integration" },
  });
  expect(audit.map((row) => row.action)).toContain("tracking_integration_updated");
  expect(JSON.stringify(audit.map((row) => row.data))).not.toContain("9Q7Z");

  await expectAccessible(page, "meta");
  const width = page.viewportSize()?.width ?? 0;
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await page.goto("/admin/integrations/meta");
    await expect(page.getByTestId("tracking-log")).toBeVisible();
    await page.screenshot({
      path: `${SHOTS_DIR}/integrations-meta-${theme}-${String(width)}.png`,
      fullPage: true,
    });
    await page.goto("/admin/integrations");
    await expect(page.getByTestId("provider-tiles")).toBeVisible();
    await page.screenshot({
      path: `${SHOTS_DIR}/integrations-hub-${theme}-${String(width)}.png`,
      fullPage: true,
    });
  }
  testInfo.annotations.push({ type: "shots", description: SHOTS_DIR });
});

test("المدير يرى الإعداد بلا حقل المفتاح، والمبيعات والمحرر 404", async ({ page, browser }) => {
  const club = await newClub(db);
  const manager = await newStaff(db, club, { role: "manager", withTotp: true });
  await signIn(page, manager);
  await page.goto("/admin/integrations/snap");
  await expect(
    page.getByRole("heading", { level: 1, name: TEXTS.providers.snap.name }),
  ).toBeVisible();
  await expect(page.getByLabel(TEXTS.form.secret)).toHaveCount(0);
  await expect(page.getByTestId("secret-status")).toContainText(TEXTS.form.secretReadOnly);
  await expectAccessible(page, "manager-snap");

  for (const role of ["sales", "editor"] as const) {
    const context = await browser.newContext({ viewport: page.viewportSize() });
    const other = await context.newPage();
    await signIn(other, await newStaff(db, club, { role, withTotp: true }));
    for (const path of ["/admin/integrations", "/admin/integrations/meta"]) {
      const response = await other.goto(path);
      expect(response?.status(), `${role} ${path}`).toBe(404);
    }
    await context.close();
  }
});

test("منصة مجهولة 404، وحدث اختبار بلا مفتاح يُرفض بسببه، وصفحة GTM تنبّه لوسوم الحاوية", async ({
  page,
}) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  await page.goto("/admin/integrations/gtm");
  await expect(page.getByText(TEXTS.gtmContainerNote)).toBeVisible();
  expect((await page.goto("/admin/integrations/myspace"))?.status()).toBe(404);
  await page.goto("/admin/integrations/ga4");
  await page.getByRole("button", { name: TEXTS.test.submit }).click();
  await expect(formAlert(page)).toHaveText(TEXT.errors["tracking.not_configured"]);
});

test("X: البكسل وأحداثه بأنماطها، ولا مفتاح خادمي ولا حدث اختبار، وخانة الجوال مفعّلة افتراضيًا", async ({
  page,
}, testInfo) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  await page.goto("/admin/integrations/x");
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.providers.x.name })).toBeVisible();
  await expect(page.getByText(TEXTS.form.browserOnlyX)).toBeVisible();
  await expect(page.getByRole("button", { name: TEXTS.test.submit })).toHaveCount(0);
  await expect(page.getByLabel(TEXTS.form.sendHashedPhone)).toBeChecked();

  const fields = TEXTS.form.fields;
  // النموذج يعود إلى المحفوظ بعد كل إرسال، فكل محاولة تملأ حقولها كلها
  const saveX = async (purchaseEventId: string) => {
    await page.getByLabel(TEXTS.form.enabled, { exact: true }).check();
    await page.getByLabel(fields.pixelId.label).fill("o8z5x");
    await page.getByLabel(fields.purchaseEventId.label).fill(purchaseEventId);
    await page.getByLabel(TEXTS.form.sendHashedPhone).uncheck();
    await page.getByRole("button", { name: TEXTS.form.submit }).click();
  };
  await saveX("tw-zzzzz-p1q2r");
  await expect(formAlert(page)).toHaveText(TEXT.errors["tracking.pixel_mismatch_purchaseEventId"]);
  await saveX("tw-o8z5x-p1q2r");
  await expect(page.getByText(TEXT.notices.tracking_saved)).toBeVisible();
  await expect(page.getByLabel(TEXTS.form.sendHashedPhone)).not.toBeChecked();
  const saved = await db.trackingIntegration.findUniqueOrThrow({
    where: { clubId_provider: { clubId: club.id, provider: "x" } },
  });
  expect(saved.config).toEqual({
    pixelId: "o8z5x",
    purchaseEventId: "tw-o8z5x-p1q2r",
    sendHashedPhone: false,
  });
  await expectAccessible(page, "x");

  const width = page.viewportSize()?.width ?? 0;
  for (const theme of ["light", "dark"] as const) {
    await setTheme(page, theme);
    await page.goto("/admin/integrations/x");
    await expect(page.getByText(TEXTS.log.emptyTitle)).toBeVisible();
    await page.screenshot({
      path: `${SHOTS_DIR}/integrations-x-${theme}-${String(width)}.png`,
      fullPage: true,
    });
    await page.goto("/admin/integrations");
    await expect(page.getByTestId("provider-tiles").getByText("tw-o8z5x-p1q2r")).toBeVisible();
    await page.screenshot({
      path: `${SHOTS_DIR}/integrations-hub-x-${theme}-${String(width)}.png`,
      fullPage: true,
    });
  }
  testInfo.annotations.push({ type: "shots", description: SHOTS_DIR });
});
