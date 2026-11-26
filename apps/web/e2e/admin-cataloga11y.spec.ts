import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import {
  field,
  linkAddon,
  PLANS,
  planUrl,
  PROMOTIONS,
  promotionUrl,
  seedCouponOrder,
  seedProduct,
  seedPromotion,
  SETTINGS,
} from "./admin-catalog-support";
import { formAlert, newClub, newStaff, setTheme, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/** فحص WCAG 2.2 AA الآلي (axe) لصفحات الكتالوج والعروض وإعدادات البيع في المظهرين، بمقاسي المشروعين. */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["dark", "light"] as const;

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
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? "?"}): ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
  expect(summary, name).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `تمرير أفقي: ${name}`).toBeLessThanOrEqual(0);
}

test("صفحات الكتالوج والعروض وإعدادات البيع بلا مخالفات وصول آلية في المظهرين", async ({
  page,
}) => {
  test.slow();
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const seed = { db, club, staff: owner };
  const plan = await seedProduct(seed, { price: "2400", bonusMonths: "0" });
  const draft = await seedProduct(seed, { price: "2500", bonusMonths: "0" }, false);
  const addon = await seedProduct(seed, { kind: "addon", price: "50" });
  await linkAddon(seed, addon, [plan]);
  const used = await seedPromotion(seed, { maxRedemptions: "5" });
  const fresh = await seedPromotion(
    seed,
    { scope: "listed_products", productIds: [plan.id] },
    false,
  );
  await seedCouponOrder(db, { planSlug: plan.slug, totalMinor: 216_000, code: used.code });
  await signIn(page, owner);
  const pages = [
    "/admin/sales/plans",
    "/admin/sales/plans?kind=addon",
    "/admin/sales/plans/new",
    "/admin/sales/plans/new?kind=addon",
    planUrl(plan),
    planUrl(plan, "pricing"),
    planUrl(plan, "preview"),
    planUrl(addon),
    `${planUrl(plan)}/status?to=unpublish`,
    `${planUrl(plan)}/status?to=archive`,
    `${planUrl(draft)}/status?to=publish`,
    "/admin/sales/promotions",
    "/admin/sales/promotions?tab=paused",
    "/admin/sales/promotions/new",
    promotionUrl(used),
    promotionUrl(fresh),
    `${promotionUrl(fresh)}/status?to=activate`,
    `${promotionUrl(used)}/status?to=pause`,
    `${promotionUrl(used)}/status?to=end`,
    "/admin/sales/settings",
    "/admin/audit?entity=product",
  ];
  for (const theme of THEMES) {
    await setTheme(page, theme);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectAccessible(page, `${theme} ${path}`);
    }
    // حالات لا تُفتح برابط: أخطاء الحقول، ومراجعة تغيير السعر، ومراجعة الإعدادات
    await page.goto("/admin/sales/plans/new");
    await field(page, PLANS.form.slug).fill("Bad Slug");
    await page.getByRole("button", { name: PLANS.new.submit }).click();
    await expect(formAlert(page)).toBeVisible();
    await expectAccessible(page, `${theme} plan errors`);
    await page.goto(planUrl(plan, "pricing"));
    await field(page, PLANS.form.price).fill("2,650");
    await page.getByRole("button", { name: PLANS.form.saveTerms }).click();
    await expect(page.getByTestId("form-review")).toBeVisible();
    await expectAccessible(page, `${theme} price review`);
    await page.goto("/admin/sales/promotions/new");
    await field(page, PROMOTIONS.form.percent).fill("150");
    await page.getByRole("button", { name: PROMOTIONS.new.submit }).click();
    await expect(formAlert(page)).toBeVisible();
    await expectAccessible(page, `${theme} promotion errors`);
    await page.goto("/admin/sales/settings");
    await field(page, SETTINGS.window.label).fill("45");
    await page.getByRole("button", { name: SETTINGS.review, exact: true }).click();
    await expect(page.getByTestId("form-review")).toBeVisible();
    await expectAccessible(page, `${theme} settings review`);
  }
});

test("لوحة المفاتيح: نموذج المنتج يُرسل بـEnter، والتركيز ينتقل إلى رسالة الخطأ", async ({
  page,
}) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/sales/plans/new");
  await field(page, PLANS.form.slug).fill("Bad Slug");
  await field(page, PLANS.form.slug).press("Enter");
  await expect(formAlert(page)).toBeVisible();
  await expect(page.locator("form > div[tabindex='-1']").first()).toBeFocused();
});
