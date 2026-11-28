import { oldestClubId, type Db } from "@masar/db";
import { CONSENT_COOKIE } from "@masar/domain";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { consentAr } from "../src/i18n/dictionaries/consent-ar";
import { privacyAr } from "../src/i18n/dictionaries/privacy-ar";
import { newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * الموافقة والوسوم على نادي الموقع العام (ADMIN_A5_TRACKING §3، §10). مشروع أخير: يفعّل GA4 وميتا
 * بمعرّفات اختبار من اللوحة ثم يطفئهما. المتصفح يحجب كل مضيف طرف ثالث ويسجّل طلباته، فلا يخرج شيء.
 */
const GA4_ID = "G-E2ETEST01";
const META_PIXEL = "100000000000042";
const X_PIXEL = "e2ex1";
const X_PURCHASE = "tw-e2ex1-buy01";
const SHOTS_DIR = "screens/tracking";
const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

let db: Db;
let siteClub: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  db = testDb();
  const id = await oldestClubId(db);
  if (id === null) {
    throw new Error("لا نادي للموقع: شغّل البيانات التجريبية");
  }
  siteClub = id;
});

test.afterAll(async () => {
  await db.$executeRaw`UPDATE tracking_integrations SET enabled = false WHERE club_id = ${siteClub}::uuid`;
  await db.$disconnect();
});

/** كل طلب لغير الخادم المحلي يُسجَّل ويُرد عليه فارغًا: لا شبكة حقيقية. */
async function recordThirdParty(context: BrowserContext): Promise<string[]> {
  const requests: string[] = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  return requests;
}

async function enable(page: Page, provider: "ga4" | "meta", field: string, value: string) {
  await page.goto(`/admin/integrations/${provider}`);
  await page.getByLabel(TEXT.integrations.form.enabled, { exact: true }).check();
  await page.getByLabel(field).fill(value);
  await page.getByRole("button", { name: TEXT.integrations.form.submit }).click();
  await expect(page.getByText(TEXT.notices.tracking_saved)).toBeVisible();
}

function banner(page: Page) {
  return page.getByTestId("consent-banner");
}

test("بلا منصة مفعّلة: لا شريط ولا رابط إعدادات ولا CSP موسَّعة", async ({ page }) => {
  await db.$executeRaw`UPDATE tracking_integrations SET enabled = false WHERE club_id = ${siteClub}::uuid`;
  const requests = await recordThirdParty(page.context());
  // ذاكرة الإعداد في الخادم 30 ثانية: ما بقي من تشغيل سابق على خادم مُعاد استعماله ينقضي خلالها
  await expect
    .poll(async () => (await page.goto("/"))?.headers()["content-security-policy"] ?? "facebook", {
      timeout: 40_000,
      intervals: [2_000],
    })
    .not.toContain("facebook");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: consentAr.settingsLink })).toHaveCount(0);
  await expect(page.getByRole("link", { name: consentAr.privacyLink })).toBeVisible();
  expect(requests).toEqual([]);
});

test("المالك يفعّل GA4 وميتا، والزائر يرى الشريط ولا يُحمَّل شيء قبل موافقته", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, await newStaff(db, { id: siteClub }, { withTotp: true }));
  await enable(admin, "ga4", TEXT.integrations.form.fields.measurementId.label, GA4_ID);
  await enable(admin, "meta", TEXT.integrations.form.fields.pixelId.label, META_PIXEL);
  await adminContext.close();

  for (const size of SIZES) {
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: size, colorScheme });
      const requests = await recordThirdParty(context);
      const page = await context.newPage();
      const response = await page.goto("/");
      const csp = response?.headers()["content-security-policy"] ?? "";
      expect(csp).toContain("https://www.facebook.com");
      expect(csp).toContain("https://*.google-analytics.com");
      expect(csp).not.toContain("snapchat");
      await expect(banner(page)).toBeVisible();
      // الأسماء اللاتينية معزولة الاتجاه بفاصل لغة الصفحة (لا «Metag Google»)
      expect(await banner(page).locator("bdi").allTextContents()).toEqual(["Google", "Meta"]);
      await expect(banner(page)).toContainText("Google، Meta");
      await page.screenshot({
        path: `${SHOTS_DIR}/consent-${colorScheme}-${String(size.width)}.png`,
      });
      await banner(page).getByRole("button", { name: consentAr.customize }).click();
      await page.screenshot({
        path: `${SHOTS_DIR}/consent-custom-${colorScheme}-${String(size.width)}.png`,
      });
      expect(requests).toEqual([]);
      await context.close();
    }
  }
});

test("الرفض بنقرة، ثم السحب والتعديل من التذييل: كل فئة تحمّل وسمها وحده", async ({ browser }) => {
  const context = await browser.newContext();
  const requests = await recordThirdParty(context);
  const page = await context.newPage();
  await page.goto("/");
  await banner(page).getByRole("button", { name: consentAr.rejectAll }).click();
  await expect(banner(page)).toHaveCount(0);
  const cookie = (await context.cookies()).find((item) => item.name === CONSENT_COOKIE);
  expect(cookie?.value).toMatch(/^v1\.a0\.m0\.\d+$/);
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: consentAr.settingsLink }).click();
  await expect(banner(page)).toBeVisible();
  await banner(page).getByLabel(consentAr.categories.analytics.label).check();
  await banner(page).getByRole("button", { name: consentAr.save }).click();
  await expect.poll(() => requests.some((url) => url.includes(`gtag/js?id=${GA4_ID}`))).toBe(true);
  expect(requests.some((url) => url.includes("facebook"))).toBe(false);

  await page.getByRole("button", { name: consentAr.settingsLink }).click();
  await banner(page).getByRole("button", { name: consentAr.acceptAll }).click();
  await expect
    .poll(() => requests.some((url) => url.includes("connect.facebook.net/en_US/fbevents.js")))
    .toBe(true);
  await context.close();
});

test("X بعد موافقة الإعلانات وحدها: مضيفاته في CSP، وuwt.js بالـnonce، ومزاياه الآلية مطفأة", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, await newStaff(db, { id: siteClub }, { withTotp: true }));
  await admin.goto("/admin/integrations/x");
  await admin.getByLabel(TEXT.integrations.form.enabled, { exact: true }).check();
  await admin.getByLabel(TEXT.integrations.form.fields.pixelId.label).fill(X_PIXEL);
  await admin.getByLabel(TEXT.integrations.form.fields.purchaseEventId.label).fill(X_PURCHASE);
  await admin.getByRole("button", { name: TEXT.integrations.form.submit }).click();
  await expect(admin.getByText(TEXT.notices.tracking_saved)).toBeVisible();
  await adminContext.close();

  const context = await browser.newContext();
  const requests = await recordThirdParty(context);
  const page = await context.newPage();
  const csp = (await page.goto("/"))?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("https://analytics.twitter.com");
  expect(csp).toContain("https://t.co");
  await expect(banner(page).locator("bdi", { hasText: /^X$/ })).toHaveCount(1);
  await banner(page).getByRole("button", { name: consentAr.customize }).click();
  await banner(page).getByLabel(consentAr.categories.analytics.label).check();
  await banner(page).getByRole("button", { name: consentAr.save }).click();
  await expect.poll(() => requests.some((url) => url.includes(`gtag/js?id=${GA4_ID}`))).toBe(true);
  expect(requests.some((url) => url.includes("ads-twitter.com"))).toBe(false);

  await page.getByRole("button", { name: consentAr.settingsLink }).click();
  await banner(page).getByRole("button", { name: consentAr.acceptAll }).click();
  await expect
    .poll(() => requests.some((url) => url === "https://static.ads-twitter.com/uwt.js"))
    .toBe(true);
  const script = page.locator('script[src="https://static.ads-twitter.com/uwt.js"]');
  expect(await script.evaluate((node: HTMLScriptElement) => node.nonce)).not.toBe("");
  const queue = await page.evaluate(() => JSON.stringify(window.twq?.queue ?? []));
  expect(JSON.parse(queue)).toEqual(
    expect.arrayContaining([
      ["set", "autoAdvancedMatching", "false", X_PIXEL],
      ["set", "dataLayerTracking", "false", X_PIXEL],
      ["config", X_PIXEL],
    ]),
  );
  await context.close();
});

test("صفحة الخصوصية من القاموس", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: privacyAr.title })).toBeVisible();
  expect(await page.locator("main bdi").allTextContents()).toEqual([...privacyAr.providers]);
  for (const section of privacyAr.sections) {
    await expect(page.getByRole("heading", { level: 2, name: section.heading })).toBeVisible();
  }
});
