import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import {
  CHECKOUT_ORIGIN,
  expectNotice,
  field,
  PROMOTIONS,
  promotionLink,
  promotionUrl,
  seedCouponOrder,
  seedProduct,
  seedPromotion,
  SETTINGS,
  uniqueCode,
} from "./admin-catalog-support";
import { formAlert, newClub, newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * العروض وإعدادات البيع في اللوحة (ADMIN_A2_SALES §5 و§9): كوبون يُنشأ ويُفعَّل فيقبله الموقع، ويُوقف
 * فيرفضه؛ العدّادات من الطلبات؛ التجميد بعد أول استخدام؛ القفل المتفائل؛ وإعدادات المالك تفتح الشراء.
 */
const form = PROMOTIONS.form;
const NOTICES = TEXT.notices;
const ERRORS = TEXT.errors;
const PLAN = { nameAr: "باقة العروض", nameEn: "Promotions plan", price: "2400", bonusMonths: "0" };
const COUPON_REJECTED = "لا يمكن استخدام هذا الكوبون لهذا الطلب. تأكد من كتابته أو أزله.";

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function confirmStatus(page: Page, path: string, action: "activate" | "pause" | "end") {
  await page.goto(`${path}/status?to=${action}`);
  await page.getByRole("button", { name: PROMOTIONS.status.submit[action] }).click();
  await expect(page).toHaveURL(/done=promotion_(activated|paused|ended)$/);
}

test("إنشاء كوبون ← تفعيل ← يُقبل في الموقع ← إيقاف ← يُرفض ← تفعيل من جديد", async ({ page }) => {
  test.slow();
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const plan = await seedProduct({ db, club, staff: owner }, PLAN);
  const code = uniqueCode("PANEL");
  const checkout = (coupon: string): string =>
    `${CHECKOUT_ORIGIN}/checkout/${plan.slug}?coupon=${coupon}`;
  await signIn(page, owner);

  await page.goto("/admin/sales/promotions/new");
  await field(page, form.code).fill("ab");
  await field(page, form.percent).fill("150");
  await page.getByRole("button", { name: PROMOTIONS.new.submit }).click();
  await expect(formAlert(page)).toHaveText(ERRORS["form.fix_fields"]);
  await expect(page.getByText(ERRORS["promotion.code_invalid"])).toBeVisible();
  await expect(page.getByText(ERRORS["promotion.percent_invalid"])).toBeVisible();
  await field(page, form.code).fill(code.toLowerCase());
  await field(page, form.nameAr).fill("خصم اللوحة");
  await field(page, form.nameEn).fill("Panel discount");
  await field(page, form.percent).fill("12.5");
  await field(page, form.maxRedemptions).fill("5");
  await page.getByRole("button", { name: PROMOTIONS.new.submit }).click();
  await expectNotice(page, NOTICES.promotion_created);
  const path = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("خصم اللوحة");

  // مسودة: الموقع يرفض الرمز
  await page.goto(checkout(code));
  await expect(page.locator("#coupon-message")).toHaveText(COUPON_REJECTED);
  await expect(page.getByTestId("order-total")).toContainText("2,400 ر.س");

  // التفعيل: صفحة التأكيد تعيد عرض الخصم والحد قبل الزر
  await page.goto(`${path}/status?to=activate`);
  const terms = page.getByTestId("promotion-terms");
  await expect(terms).toContainText(code);
  await expect(terms).toContainText("12.5%");
  await expect(terms).toContainText("5");
  await page.getByRole("button", { name: PROMOTIONS.status.submit.activate }).click();
  await expectNotice(page, NOTICES.promotion_activated);
  await page.goto(checkout(code));
  await expect(page.getByTestId("order-total")).toContainText("2,100 ر.س");

  await confirmStatus(page, path, "pause");
  await page.goto(checkout(code));
  await expect(page.locator("#coupon-message")).toHaveText(COUPON_REJECTED);
  await expect(page.getByTestId("order-total")).toContainText("2,400 ر.س");

  await confirmStatus(page, path, "activate");
  await page.goto(checkout(code));
  await expect(page.getByTestId("order-total")).toContainText("2,100 ر.س");

  // رمز مستعمل، ولو بعد إنهاء عرضه، لا يُعاد
  await confirmStatus(page, path, "end");
  await page.goto("/admin/sales/promotions/new");
  await field(page, form.code).fill(code);
  await field(page, form.nameAr).fill("محاولة ثانية");
  await field(page, form.nameEn).fill("Second try");
  await field(page, form.percent).fill("10");
  await page.getByRole("button", { name: PROMOTIONS.new.submit }).click();
  await expect(page.getByText(ERRORS["promotion.code_taken"])).toBeVisible();
  const actions = await db.auditLog.findMany({
    where: { entityType: "promotion", clubId: club.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  expect(actions.map((row) => row.action)).toEqual([
    "promotion_created",
    "promotion_activated",
    "promotion_paused",
    "promotion_activated",
    "promotion_ended",
  ]);
  expect(actions.every((row) => row.actor === `staff:${owner.id}`)).toBe(true);
});

test("القائمة والعدّادات من الطلبات، والتجميد بعد أول استخدام، والمبيعات قراءة بلا أزرار", async ({
  page,
}) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const seed = { db, club, staff: owner };
  const plan = await seedProduct(seed, PLAN);
  const used = await seedPromotion(seed, {
    nameAr: "عرض مستعمل",
    percent: "10",
    maxRedemptions: "3",
  });
  const draft = await seedPromotion(seed, { nameAr: "عرض مسودة" }, false);
  await seedCouponOrder(db, {
    planSlug: plan.slug,
    totalMinor: 216_000,
    code: used.code,
    paid: true,
  });
  await seedCouponOrder(db, { planSlug: plan.slug, totalMinor: 216_000, code: used.code });
  await signIn(page, owner);

  await page.goto("/admin/sales/promotions");
  const rows = page.getByTestId("promotions-table").locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "عرض مستعمل" })).toContainText("2 من 3");
  await page.goto("/admin/sales/promotions?tab=draft");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("عرض مسودة");
  await page.goto("/admin/sales/promotions?tab=paused");
  await expect(page.getByText(PROMOTIONS.empty.tabTitle)).toBeVisible();

  await page.goto(promotionUrl(used));
  const usage = page.getByTestId("promotion-usage");
  await expect(usage).toContainText("2 من 3");
  await expect(usage).toContainText("240 ر.س");
  await expect(page.getByText(PROMOTIONS.detail.frozen)).toBeVisible();
  // الشروط المجمَّدة لا تُرسم حقولًا، والباقي يُعدَّل
  await expect(field(page, form.percent)).toHaveCount(0);
  await expect(field(page, form.startsAt)).toHaveCount(0);
  await field(page, form.maxRedemptions).fill("2");
  await page.getByRole("button", { name: form.save }).click();
  await expectNotice(page, NOTICES.promotion_updated_exhausted);
  await expect(page.getByText(PROMOTIONS.detail.exhaustedNote)).toBeVisible();

  await page.context().clearCookies();
  const sales = await newStaff(db, club, { role: "sales", withTotp: true });
  await signIn(page, sales);
  await page.goto("/admin/sales/promotions");
  await expect(page.getByRole("link", { name: PROMOTIONS.add })).toHaveCount(0);
  await promotionLink(page, "عرض مسودة").click();
  await expect(page.getByTestId("promotion-usage")).toBeVisible();
  await expect(page.getByRole("link", { name: PROMOTIONS.detail.activate })).toHaveCount(0);
  await expect(page.getByRole("button", { name: form.save })).toHaveCount(0);
  expect((await page.goto(`${promotionUrl(draft)}/status?to=activate`))?.status()).toBe(404);
});

test("موظفان يعدّلان العرض نفسه: الحفظ الثاني مرفوض برسالة واضحة", async ({ page, context }) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const promotion = await seedPromotion({ db, club, staff: owner }, { nameAr: "عرض مشترك" }, false);
  await signIn(page, owner);
  await page.goto(promotionUrl(promotion));
  const second = await context.newPage();
  await second.goto(promotionUrl(promotion));
  await field(page, form.nameAr).fill("تعديل الأول");
  await page.getByRole("button", { name: form.save }).click();
  await expectNotice(page, NOTICES.promotion_updated);
  await field(second, form.nameAr).fill("تعديل الثاني");
  await field(second, form.percent).fill("50");
  await second.getByRole("button", { name: form.save }).click();
  await expect(formAlert(second)).toHaveText(ERRORS["promotion.stale_edit"]);
  await expect(field(second, form.nameAr)).toHaveValue("تعديل الثاني");
  const row = await db.promotion.findUniqueOrThrow({ where: { id: promotion.id } });
  expect([row.nameAr, row.percentBps]).toEqual(["تعديل الأول", 1000]);
  // صفحة تأكيد قديمة كذلك
  await second.goto(`${promotionUrl(promotion)}/status?to=activate`);
  await page.goto(promotionUrl(promotion));
  await field(page, form.nameAr).fill("تعديل ثالث");
  await page.getByRole("button", { name: form.save }).click();
  await expectNotice(page, NOTICES.promotion_updated);
  await second.getByRole("button", { name: PROMOTIONS.status.submit.activate }).click();
  await expect(formAlert(second)).toHaveText(ERRORS["promotion.stale_edit"]);
  expect((await db.promotion.findUniqueOrThrow({ where: { id: promotion.id } })).status).toBe(
    "draft",
  );
});

test("إعدادات البيع: المالك يحسم القيمتين بعد مراجعتهما فيُفتح الشراء، والطلب يُختم بهما", async ({
  page,
}) => {
  test.slow();
  const club = await newClub(db, { orderPaymentWindowMinutes: null, membershipStartRule: null });
  const owner = await newStaff(db, club, { withTotp: true });
  const plan = await seedProduct({ db, club, staff: owner }, PLAN);
  const checkoutUrl = `${CHECKOUT_ORIGIN}/checkout/${plan.slug}`;
  await signIn(page, owner);

  // غير محسوم: الشراء مغلق كما كان، والصفحة تقول لماذا ولا تقترح قيمة
  await page.goto(checkoutUrl);
  await expect(
    page.getByRole("heading", { name: "الشراء الإلكتروني غير متاح حاليًا" }),
  ).toBeVisible();
  await page.goto("/admin/sales/settings");
  const undecided = page.getByTestId("settings-undecided");
  await expect(undecided).toContainText(SETTINGS.undecided.order_payment_window);
  await expect(undecided).toContainText(SETTINGS.undecided.membership_start_rule);
  await expect(field(page, SETTINGS.window.label)).toHaveValue("");
  await expect(field(page, SETTINGS.startRule.label)).toHaveValue("");
  await expect(page.getByText(SETTINGS.window.consequences[0])).toBeVisible();
  await expect(page.getByText(SETTINGS.window.consequences[1])).toBeVisible();

  await page.getByRole("button", { name: SETTINGS.review, exact: true }).click();
  await expect(formAlert(page)).toHaveText(ERRORS["sales_settings.no_changes"]);
  await field(page, SETTINGS.window.label).fill("0");
  await page.getByRole("button", { name: SETTINGS.review, exact: true }).click();
  await expect(page.getByText(ERRORS["sales_settings.window_invalid"])).toBeVisible();

  await field(page, SETTINGS.window.label).fill("1440");
  await field(page, SETTINGS.startRule.label).selectOption("on_payment");
  await page.getByRole("button", { name: SETTINGS.review, exact: true }).click();
  const review = page.getByTestId("form-review");
  await expect(review).toContainText(SETTINGS.window.unset);
  await expect(review).toContainText("1,440 دقيقة");
  await expect(review).toContainText(SETTINGS.startRule.options.on_payment);
  await expect(page.getByText(SETTINGS.scopeNote)).toBeVisible();
  // المراجعة لا تكتب
  expect(
    (await db.club.findUniqueOrThrow({ where: { id: club.id } })).orderPaymentWindowMinutes,
  ).toBeNull();
  await page.getByRole("button", { name: SETTINGS.confirm.submit }).click();
  await expectNotice(page, NOTICES.sales_settings_updated);
  await expect(page.getByTestId("settings-undecided")).toHaveCount(0);
  await expect(field(page, SETTINGS.window.label)).toHaveValue("1440");

  await page.goto(checkoutUrl);
  await expect(page.getByTestId("confirm-total")).toContainText("2,400 ر.س");
  await page.getByLabel("الاسم", { exact: true }).fill("عميل بعد الحسم");
  await page.getByLabel("رقم الجوال", { exact: true }).fill(`05${String(Date.now()).slice(-8)}`);
  await page.getByLabel("رقم الجوال", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/checkout\/orders\//);
  const order = await db.order.findFirstOrThrow({
    where: { clubId: club.id },
    include: { items: true },
  });
  const DAY_MS = 86_400_000;
  expect(order.expiresAt.getTime() - order.createdAt.getTime()).toBe(DAY_MS);
  expect(order.items[0]?.membershipStartRule).toBe("on_payment");
  const audit = await db.auditLog.findFirstOrThrow({
    where: { entityType: "club", entityId: club.id },
  });
  expect(audit).toMatchObject({
    action: "sales_settings_updated",
    actor: `staff:${owner.id}`,
    data: { windowBefore: null, windowAfter: 1440, startRuleAfter: "on_payment" },
  });
});
