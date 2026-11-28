import { mkdirSync } from "node:fs";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { seedCatalog } from "./admin-catalogshots-support";
import { seedPromotion } from "./admin-catalog-support";
import { publishDraft, saveText } from "./admin-content-support";
import { seedSales } from "./admin-overview-support";
import { settleAnimations, SHOT_DESKTOP, watchProblems } from "./admin-shots-support";
import { createSlide, PHOTO, PHOTO_2, uploadPhoto } from "./admin-slider-support";
import { newClub, newStaff, setTheme, signIn, submitLogin, withFreshIp } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات الصفحات الداخلية للمراجعة البصرية (ADMIN_REDESIGN R3/R4): كل صفحة داخلية بنادٍ فيه طلبات
 * وباقات وعروض وصور وشريحة ونص منشور، بثلاث حالات (1440 داكن وفاتح، و390 داكن)، كاملة الطول. المجلد
 * والبادئة من البيئة (`R3_SHOTS_DIR` و`R3_SHOTS_PREFIX`) لمقارنة «قبل» و«بعد». أداة مراجعة تُشغَّل بطلب: بلا
 * `R3_SHOTS_DIR` تُتخطى، فلا تثقل السلسلة الكاملة بسبعين لقطة.
 */
const DIR = process.env.R3_SHOTS_DIR;
const PREFIX = process.env.R3_SHOTS_PREFIX ?? "r3";
/** صفحات بعينها (أسماء مفصولة بفواصل) للمراجعة السريعة؛ الافتراضي كلها. */
const ONLY = process.env.R3_SHOTS_ONLY?.split(",") ?? null;
const HEIGHT = 900;
const STATES = [
  ["dark", 1440],
  ["light", 1440],
  ["dark", 390],
] as const;

let db: Db;

test.skip(DIR === undefined, "لقطات المراجعة بطلب: R3_SHOTS_DIR");

test.beforeAll(() => {
  db = testDb();
  if (DIR !== undefined) {
    mkdirSync(DIR, { recursive: true });
  }
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function shootStates(page: Page, name: string, path: string): Promise<void> {
  for (const [theme, width] of STATES) {
    await setTheme(page, theme);
    await page.setViewportSize({ width, height: HEIGHT });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await settleAnimations(page);
    // نقل التركيز عند التركيب قد يمرّر الصفحة؛ اللقطة الكاملة تبدأ من أعلاها
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // «قبل» تُسجَّل فيها المخالفة ولا توقف اللقطات؛ «بعد» تفشل بها
    expect.soft(overflow, `تمرير أفقي في ${name} عند ${String(width)}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `${DIR ?? ""}/${PREFIX}-${name}-${theme}-${String(width)}.png`,
      fullPage: true,
    });
  }
}

async function firstHref(page: Page, path: string, pattern: RegExp): Promise<string> {
  await page.goto(path);
  // القائمة تصل بعد هيكل التحميل (loading.tsx)
  await page.locator(`main a[href^="${path}/"]`).first().waitFor();
  const hrefs = await page
    .locator("main a[href]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const href = hrefs.find((value) => pattern.test(value));
  expect(href, `رابط ${String(pattern)} في ${path}`).toBeDefined();
  return href ?? path;
}

test("لقطات الصفحات الداخلية للمراجعة", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== SHOT_DESKTOP, "اللقطات في مشروع واحد");
  test.setTimeout(600_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const problems = watchProblems(page);
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" });
  await newStaff(db, club, { role: "manager", withTotp: true, displayName: "سارة الحربي" });
  await seedSales(db, club.id, new Date());
  const seed = { db, club, staff: owner };
  await seedCatalog(seed);
  await seedPromotion(seed, { nameAr: "عرض اليوم الوطني" });
  await seedPromotion(seed, { nameAr: "خصم الأصدقاء" }, false);

  await withFreshIp(page);
  await page.goto("/admin/login");
  await shootStates(page, "login", "/admin/login");
  await signIn(page, owner);
  await uploadPhoto(page, PHOTO);
  await uploadPhoto(page, PHOTO_2);
  await createSlide(page, {
    photo: "trainer-portrait.jpg",
    title: { ar: "ابدأ مسارك اليوم", en: "Start today" },
  });
  await saveText(page, "hero.title", "ابدأ مسارك من بريدة");
  await publishDraft(page);
  await saveText(page, "hero.title", "مسارك يبدأ اليوم");

  const customer = await db.customer.findFirst({ where: { clubId: club.id } });
  const pages: (readonly [string, string])[] = [
    ["orders", "/admin/sales/orders"],
    [
      "order",
      await firstHref(page, "/admin/sales/orders", /\/admin\/sales\/orders\/[0-9a-f-]{36}$/),
    ],
    ["customers", "/admin/sales/customers"],
    ["customer", `/admin/sales/customers/${customer?.id ?? ""}`],
    ["plans", "/admin/sales/plans"],
    ["plan", await firstHref(page, "/admin/sales/plans", /\/admin\/sales\/plans\/[0-9a-f-]{36}$/)],
    ["promotions", "/admin/sales/promotions"],
    [
      "promotion",
      await firstHref(
        page,
        "/admin/sales/promotions",
        /\/admin\/sales\/promotions\/[0-9a-f-]{36}$/,
      ),
    ],
    ["settings", "/admin/sales/settings"],
    ["content", "/admin/content"],
    ["texts", "/admin/content/texts"],
    ["texts-hero", "/admin/content/texts/hero"],
    ["slider", "/admin/content/slider"],
    ["media", "/admin/content/media"],
    ["publish", "/admin/content/publish"],
    ["history", "/admin/content/history"],
    ["staff", "/admin/staff"],
    ["staff-new", "/admin/staff/new"],
    ["staff-member", await firstHref(page, "/admin/staff", /\/admin\/staff\/[0-9a-f-]{36}$/)],
    ["audit", "/admin/audit"],
    ["integrations", "/admin/integrations"],
    ["integration", "/admin/integrations/meta"],
    ["account", "/admin/account"],
  ];
  for (const [name, path] of pages) {
    if (ONLY !== null && !ONLY.includes(name)) {
      continue;
    }
    await shootStates(page, name, path);
  }
  expect(problems).toEqual([]);
});

test("لقطة التحقق بخطوتين", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== SHOT_DESKTOP, "اللقطات في مشروع واحد");
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  await withFreshIp(page);
  await submitLogin(page, owner.email, owner.password);
  await expect(page).toHaveURL(/\/admin\/verify$/);
  await shootStates(page, "verify", "/admin/verify");
});
