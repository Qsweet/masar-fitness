import { type Db } from "@masar/db";
import { expect, test } from "@playwright/test";
import {
  expectNotice,
  field,
  PLANS,
  planUrl,
  PROMOTIONS,
  promotionUrl,
  seedCouponOrder,
  seedProduct,
  seedPromotion,
  SETTINGS,
} from "./admin-catalog-support";
import {
  SHOT_DESKTOP,
  SHOT_THEMES,
  shootAll,
  shootHere,
  watchProblems,
} from "./admin-shots-support";
import { fillNewPlan, seedCatalog, YEAR } from "./admin-catalogshots-support";
import { formAlert, newClub, newStaff, setTheme, signIn } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لقطات الكتالوج والعروض وإعدادات البيع (ADMIN_A2_SALES §12) بالمظهرين والمقاسات الأربعة: القائمة،
 * صفحة المنتج بتبويباتها وسجل نسخها، نماذج الإنشاء والتعديل بأخطائها، المعاينة، تأكيدات النشر والإخفاء
 * والأرشفة، العروض بعدّاداتها وتأكيداتها، وإعدادات البيع.
 */
const form = PLANS.form;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.beforeEach(({ page }) => {
  test.skip(
    page.viewportSize()?.width !== SHOT_DESKTOP,
    "اللقطات في مشروع واحد: الاختبار يغيّر المقاس",
  );
});

test("الكتالوج بالمظهرين والمقاسات الأربعة", async ({ page }) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" });
  const seed = { db, club, staff: owner };
  await signIn(page, owner);

  await page.goto("/admin/sales/plans");
  await shootAll(page, "catalog-plans-empty");
  await page.goto("/admin/sales/plans/new");
  await shootAll(page, "catalog-plan-new");
  await field(page, form.slug).fill("Three Months");
  await field(page, form.price).fill("1,5");
  await page.getByRole("button", { name: PLANS.new.submit }).click();
  await expect(formAlert(page)).toBeVisible();
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.reload();
    await field(page, form.slug).fill("Three Months");
    await field(page, form.price).fill("1,5");
    await page.getByRole("button", { name: PLANS.new.submit }).click();
    await expect(formAlert(page)).toBeVisible();
    await shootHere(page, "catalog-plan-new-errors", theme);
  }
  await setTheme(page, "dark");
  await page.goto("/admin/sales/plans/new");
  const slug = `ct-shots-${club.id.slice(-8)}`;
  await fillNewPlan(page, slug);
  await page.getByRole("button", { name: PLANS.new.submit }).click();
  await expectNotice(page, TEXT_NOTICES.product_created);
  await shootAll(page, "catalog-plan-created");
  const draftUrl = new URL(page.url()).pathname;

  await page.goto(`${draftUrl}/status?to=publish`);
  await shootAll(page, "catalog-plan-publish");
  await page.getByRole("button", { name: PLANS.status.submit.publish }).click();
  await expectNotice(page, TEXT_NOTICES.product_published);

  const { year, addon } = await seedCatalog(seed);
  await seedProduct(
    seed,
    {
      nameAr: "شهر واحد",
      nameEn: "One month",
      price: "299",
      durationMonths: "1",
      bonusMonths: "0",
      tierAr: "",
      tierEn: "",
    },
    false,
  );
  await page.goto("/admin/sales/plans");
  await shootAll(page, "catalog-plans");
  await page.goto("/admin/sales/plans?kind=addon");
  await shootAll(page, "catalog-addons");

  await page.goto(planUrl(year));
  await shootAll(page, "catalog-plan-details");
  await page.goto(planUrl(addon));
  await shootAll(page, "catalog-addon-details");
  await seedCouponOrder(db, { planSlug: year.slug, totalMinor: 149_900, code: null });
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.goto(planUrl(year, "pricing"));
    await field(page, form.price).fill("1,599");
    await page.getByRole("button", { name: form.saveTerms }).click();
    await expect(page.getByTestId("form-review")).toBeVisible();
    await shootHere(page, "catalog-plan-price-review", theme);
  }
  await setTheme(page, "dark");
  await page.goto(planUrl(year, "pricing"));
  await field(page, form.price).fill("1,599");
  await page.getByRole("button", { name: form.saveTerms }).click();
  await page.getByRole("button", { name: PLANS.termsConfirm.confirm }).click();
  await expectNotice(page, TEXT_NOTICES.product_version_created);
  await shootAll(page, "catalog-plan-pricing");
  await page.goto(planUrl(year, "preview"));
  await shootAll(page, "catalog-plan-preview");

  await page.goto(`${planUrl(year)}/status?to=unpublish`);
  await shootAll(page, "catalog-plan-unpublish");
  await page.goto(`${planUrl(year)}/status?to=archive`);
  await shootAll(page, "catalog-plan-archive");
  const lonely = await newClub(db);
  const lonelyOwner = await newStaff(db, lonely, { withTotp: true, displayName: "سارة القحطاني" });
  const only = await seedProduct({ db, club: lonely, staff: lonelyOwner }, YEAR);
  await page.context().clearCookies();
  await signIn(page, lonelyOwner);
  await page.goto(`${planUrl(only)}/status?to=archive`);
  await shootAll(page, "catalog-plan-archive-last");
  expect(problems).toEqual([]);
});

const TEXT_NOTICES = {
  product_created: "أُنشئ المنتج مسودة. لا يظهر في الموقع حتى تنشره.",
  product_published: "نُشر المنتج، وهو في الموقع الآن.",
  product_version_created: "حُفظت نسخة سعرية جديدة وتسري الآن.",
} as const;

test("العروض وإعدادات البيع بالمظهرين والمقاسات الأربعة", async ({ page }) => {
  test.slow();
  const problems = watchProblems(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const club = await newClub(db, { orderPaymentWindowMinutes: null, membershipStartRule: null });
  const owner = await newStaff(db, club, { withTotp: true, displayName: "خالد المطيري" });
  const seed = { db, club, staff: owner };
  await signIn(page, owner);

  await page.goto("/admin/sales/settings");
  await shootAll(page, "settings-undecided");
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.goto("/admin/sales/settings");
    await field(page, SETTINGS.window.label).fill("1440");
    await field(page, SETTINGS.startRule.label).selectOption("on_payment");
    await page.getByRole("button", { name: SETTINGS.review, exact: true }).click();
    await expect(page.getByTestId("form-review")).toBeVisible();
    await shootHere(page, "settings-review", theme);
  }
  await setTheme(page, "dark");
  await page.getByRole("button", { name: SETTINGS.confirm.submit }).click();
  await expect(page).toHaveURL(/done=sales_settings_updated$/);
  await shootAll(page, "settings-saved");

  await page.goto("/admin/sales/promotions");
  await shootAll(page, "promotions-empty");
  await page.goto("/admin/sales/promotions/new");
  await shootAll(page, "promotion-new");
  for (const theme of SHOT_THEMES) {
    await setTheme(page, theme);
    await page.goto("/admin/sales/promotions/new");
    await field(page, PROMOTIONS.form.code).fill("ab");
    await field(page, PROMOTIONS.form.percent).fill("150");
    await page.getByRole("button", { name: PROMOTIONS.new.submit }).click();
    await expect(formAlert(page)).toBeVisible();
    await shootHere(page, "promotion-new-errors", theme);
  }
  await setTheme(page, "dark");

  const plan = await seedProduct(seed, {
    ...YEAR,
    price: "1000",
    durationMonths: "12",
    bonusMonths: "2",
  });
  const summer = await seedPromotion(seed, {
    code: "SUMMER15",
    nameAr: "عرض الصيف",
    nameEn: "Summer offer",
    percent: "15",
    maxRedemptions: "50",
    endsAt: "2027-09-01T00:00",
  });
  await seedPromotion(seed, {
    type: "automatic",
    nameAr: "خصم الافتتاح",
    nameEn: "Opening discount",
    discountKind: "fixed_amount",
    amount: "100",
    scope: "listed_products",
    productIds: [plan.id],
    startsAt: "2027-01-01T00:00",
  });
  const draft = await seedPromotion(
    seed,
    {
      code: "WELCOME50",
      nameAr: "ترحيب بالمشترك",
      nameEn: "Welcome",
      discountKind: "fixed_amount",
      amount: "50",
    },
    false,
  );
  const once = await seedPromotion(seed, {
    code: "FIRSTDAY",
    nameAr: "اليوم الأول",
    nameEn: "First day",
    percent: "20",
    maxRedemptions: "1",
  });
  await seedCouponOrder(db, {
    planSlug: plan.slug,
    totalMinor: 85_000,
    code: summer.code,
    paid: true,
  });
  await seedCouponOrder(db, {
    planSlug: plan.slug,
    totalMinor: 85_000,
    code: summer.code,
    paid: true,
  });
  await seedCouponOrder(db, { planSlug: plan.slug, totalMinor: 85_000, code: summer.code });
  await seedCouponOrder(db, { planSlug: plan.slug, totalMinor: 80_000, code: once.code });

  await page.goto("/admin/sales/promotions");
  await shootAll(page, "promotions");
  await page.goto("/admin/sales/promotions?tab=paused");
  await shootAll(page, "promotions-tab-empty");
  await page.goto(promotionUrl(summer));
  await shootAll(page, "promotion-detail-used");
  await page.goto(promotionUrl(draft));
  await shootAll(page, "promotion-detail-draft");
  await page.goto(`${promotionUrl(draft)}/status?to=activate`);
  await shootAll(page, "promotion-activate");
  await page.goto(`${promotionUrl(summer)}/status?to=pause`);
  await shootAll(page, "promotion-pause");
  await page.goto(`${promotionUrl(summer)}/status?to=end`);
  await shootAll(page, "promotion-end");
  await page.getByRole("button", { name: PROMOTIONS.status.submit.end }).click();
  await expect(page).toHaveURL(/done=promotion_ended$/);
  await shootAll(page, "promotion-ended");
  await page.goto(`/admin/sales/promotions/new?from=${summer.id}`);
  await shootAll(page, "promotion-copy");
  expect(problems).toEqual([]);
});
