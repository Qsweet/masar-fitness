import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import {
  CHECKOUT_ORIGIN,
  expectNotice,
  field,
  planLink,
  planRows,
  PLANS,
  planUrl,
  seedProduct,
  type SeededProduct,
} from "./admin-catalog-support";
import { formAlert, newClub, newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * الكتالوج في اللوحة (ADMIN_A2_SALES §4 و§10): الأدوار، الإنشاء والنسخ، القفل المتفائل، وأثر كل تغيير
 * على الموقع العام فورًا (الصفحات والخريطة والسلة وعرض السعر)، وأن طلبًا سابقًا يحتفظ بلقطته.
 * أسعار الاختبار أغلى شهريًا من بذرة المعاينة عمدًا، فلا تأخذ باقة اختبار شارة «الأكثر قيمة» في الموقع.
 */
const form = PLANS.form;
const NOTICES = TEXT.notices;
const ERRORS = TEXT.errors;
const ORDER_URL = /\/checkout\/orders\/[A-Za-z0-9_-]{43}$/;
const PLAN = {
  nameAr: "باقة الاختبار الفصلية",
  nameEn: "Quarterly test plan",
  summaryAr: "باقة لاختبار اللوحة.",
  summaryEn: "A plan for testing the panel.",
  tierAr: "فئة التجربة",
  tierEn: "Trial tier",
  price: "2400",
  durationMonths: "3",
  bonusMonths: "0",
};

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function statusOf(page: Page, path: string): Promise<number | undefined> {
  return (await page.goto(path))?.status();
}

async function confirmStatus(page: Page, product: SeededProduct, action: "publish" | "unpublish") {
  await page.goto(`${planUrl(product)}/status?to=${action}`);
  await page.getByRole("button", { name: PLANS.status.submit[action] }).click();
  await expectNotice(
    page,
    action === "publish" ? NOTICES.product_published : NOTICES.product_unpublished,
  );
}

async function sitemap(page: Page): Promise<string> {
  const response = await page.request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  return response.text();
}

test("الأدوار: المبيعات تقرأ الكتالوج بلا أي كتابة، والمحرر لا يرى شيئًا، والمدير بلا إعدادات البيع", async ({
  page,
}) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club);
  const plan = await seedProduct({ db, club, staff: owner }, PLAN);
  const sales = await newStaff(db, club, { role: "sales", withTotp: true });
  await signIn(page, sales);
  await page.goto("/admin/sales/plans");
  await expect(planRows(page)).toHaveCount(1);
  await expect(page.getByRole("link", { name: PLANS.add.membership })).toHaveCount(0);
  await planLink(page, PLAN.nameAr).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLAN.nameAr);
  await expect(page.getByRole("link", { name: PLANS.detail.unpublish })).toHaveCount(0);
  await expect(page.getByRole("button", { name: form.saveIdentity })).toHaveCount(0);
  await page.goto(planUrl(plan, "pricing"));
  await expect(page.getByTestId("current-price")).toContainText("2,400");
  await expect(page.getByRole("button", { name: form.saveTerms })).toHaveCount(0);
  await page.goto(planUrl(plan, "preview"));
  await expect(page.getByTestId("plan-preview")).toContainText(PLAN.tierEn);
  for (const path of [
    "/admin/sales/plans/new",
    `${planUrl(plan)}/status?to=archive`,
    "/admin/sales/promotions/new",
    "/admin/sales/settings",
  ]) {
    expect(await statusOf(page, path), path).toBe(404);
  }

  await page.context().clearCookies();
  const editor = await newStaff(db, club, { role: "editor", withTotp: true });
  await signIn(page, editor);
  for (const path of ["/admin/sales/plans", planUrl(plan), "/admin/sales/promotions"]) {
    expect(await statusOf(page, path), path).toBe(404);
  }

  await page.context().clearCookies();
  const manager = await newStaff(db, club, { role: "manager", withTotp: true });
  await signIn(page, manager);
  expect(await statusOf(page, "/admin/sales/settings")).toBe(404);
  expect(await statusOf(page, "/admin/sales/plans/new")).toBe(200);
  await page.goto(planUrl(plan));
  await expect(page.getByRole("link", { name: PLANS.detail.unpublish })).toBeVisible();
});

test("إنشاء مسودة ← أخطاء الحقول ← تعديل السعر ← سجل النسخ، والإرسال المزدوج لا ينشئ منتجين", async ({
  page,
}) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  await signIn(page, owner);
  const slug = `ct-e2e-new-${club.id.slice(-10)}`;
  await page.goto("/admin/sales/plans/new");
  await field(page, form.slug).fill("Bad Slug");
  await field(page, form.nameAr).fill(PLAN.nameAr);
  await field(page, form.price).fill("1,5");
  await page.getByRole("button", { name: PLANS.new.submit }).click();
  await expect(formAlert(page)).toHaveText(ERRORS["form.fix_fields"]);
  await expect(page.getByText(ERRORS["catalog.slug_invalid"])).toBeVisible();
  await expect(page.getByText(ERRORS["amount.invalid_format"])).toBeVisible();
  // ما كُتب يعود كما هو
  await expect(field(page, form.nameAr)).toHaveValue(PLAN.nameAr);
  await expect(field(page, form.slug)).toHaveAttribute("aria-invalid", "true");

  await field(page, form.slug).fill(slug);
  await field(page, form.nameEn).fill(PLAN.nameEn);
  await field(page, form.price).fill("2,400");
  await field(page, form.durationMonths).fill("3");
  await page.getByRole("button", { name: PLANS.new.submit }).click();
  await expectNotice(page, NOTICES.product_created);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLAN.nameAr);
  const productPath = new URL(page.url()).pathname;

  // رجوع وإرسال ثانٍ: المنتج واحد (المعرّف نفسه إعادة، أو معرّف جديد يصطدم بالمعرّف النصي)
  await page.goBack();
  await page.getByRole("button", { name: PLANS.new.submit }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await db.product.count({ where: { slug } })).toBe(1);

  // مسودة: السعر يُحفظ مباشرة بلا خطوة مراجعة، بنسخة جديدة
  await page.goto(`${productPath}?tab=pricing`);
  await expect(page.getByTestId("versions-table").locator("tbody tr")).toHaveCount(1);
  await field(page, form.price).fill("2,650.50");
  await page.getByRole("button", { name: form.saveTerms }).click();
  await expectNotice(page, NOTICES.product_version_created);
  const versions = page.getByTestId("versions-table").locator("tbody tr");
  await expect(versions).toHaveCount(2);
  await expect(versions.first()).toContainText("2,650.50");
  await expect(versions.first()).toContainText(PLANS.detail.versionStates.current);
  await expect(versions.last()).toContainText("2,400");
  await expect(versions.last()).toContainText(PLANS.detail.versionStates.past);
  await expect(page.getByTestId("current-price")).toContainText("345.72");
  const rows = await db.productVersion.findMany({
    where: { product: { slug } },
    orderBy: { validFrom: "asc" },
  });
  expect(rows.map((row) => row.priceMinor)).toEqual([240_000, 265_050]);
  expect(rows[0]?.validUntil).toEqual(rows[1]?.validFrom);
});

test("موظفان يعدّلان الباقة نفسها: الحفظ الثاني مرفوض برسالة واضحة ولا دمج صامت", async ({
  page,
  context,
}) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const plan = await seedProduct({ db, club, staff: owner }, PLAN, false);
  await signIn(page, owner);
  await page.goto(planUrl(plan));
  const second = await context.newPage();
  await second.goto(planUrl(plan));
  await field(page, form.nameAr).fill("اسم الموظف الأول");
  await page.getByRole("button", { name: form.saveIdentity }).click();
  await expectNotice(page, NOTICES.product_updated);
  await field(second, form.nameAr).fill("اسم الموظف الثاني");
  await second.getByRole("button", { name: form.saveIdentity }).click();
  await expect(formAlert(second)).toHaveText(ERRORS["catalog.stale_edit"]);
  await expect(field(second, form.nameAr)).toHaveValue("اسم الموظف الثاني");
  expect((await db.product.findUniqueOrThrow({ where: { id: plan.id } })).nameAr).toBe(
    "اسم الموظف الأول",
  );
  // السعر كذلك: صفحة قديمة لا تكتب نسخة
  await second.goto(planUrl(plan, "pricing"));
  await page.goto(planUrl(plan, "pricing"));
  await field(page, form.price).fill("2500");
  await page.getByRole("button", { name: form.saveTerms }).click();
  await expectNotice(page, NOTICES.product_version_created);
  await field(second, form.price).fill("2600");
  await second.getByRole("button", { name: form.saveTerms }).click();
  await expect(formAlert(second)).toHaveText(ERRORS["catalog.stale_edit"]);
  expect(await db.productVersion.count({ where: { productId: plan.id } })).toBe(2);
});

test("النشر وتغيير السعر والإخفاء تظهر فورًا في الموقع والخريطة والسلة وعرض السعر، والطلب السابق بلقطته", async ({
  page,
}) => {
  test.slow();
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  // اسم وفئة فريدان: اختبارات أخرى تنشر باقاتها في الموقع نفسه في الوقت نفسه
  const unique = club.id.slice(-8);
  const names = {
    nameAr: `باقة فريدة ${unique}`,
    tierAr: `فئة ${unique}`,
    tierEn: `Tier ${unique}`,
  };
  const plan = await seedProduct({ db, club, staff: owner }, { ...PLAN, ...names }, false);
  // باقة ثانية منشورة: إخفاء الأولى ليس إخفاء آخر باقة تُباع
  await seedProduct({ db, club, staff: owner }, { ...PLAN, nameAr: "باقة أخرى", price: "2500" });
  const planPage = `/memberships/${plan.slug}`;
  const shop = (path: string): string => `${CHECKOUT_ORIGIN}${path}`;
  await signIn(page, owner);

  // مسودة: لا صفحة ولا خريطة
  expect(await statusOf(page, planPage)).toBe(404);
  expect(await sitemap(page)).not.toContain(planPage);

  await confirmStatus(page, plan, "publish");
  // في المحدِّد: مقطع للباقة، وبطاقتها باسمها واسم فئتها من القاعدة باللغتين حين تُختار
  const picked = page.locator("#plans [data-plan-card]");
  await page.goto("/memberships");
  await page.locator(`#plans input[name="plan"][value="${plan.slug}"]`).check();
  await expect(picked.getByText(names.nameAr, { exact: true })).toBeVisible();
  await expect(picked.getByText(names.tierAr, { exact: true })).toBeVisible();
  await page.goto("/en/memberships");
  await page.locator(`#plans input[name="plan"][value="${plan.slug}"]`).check();
  await expect(picked.getByText(names.tierEn, { exact: true })).toBeVisible();
  expect(await sitemap(page)).toContain(planPage);

  // طلب بالسعر الأول عبر السلة وعرض السعر
  await page.goto(shop(planPage));
  await expect(page.locator("#top")).toContainText("2,400 ر.س");
  await page.locator("#top").getByRole("button", { name: "اشترِ الآن" }).click();
  await expect(page.getByTestId("order-total")).toContainText("2,400 ر.س");
  await page.goto(shop(`/checkout/${plan.slug}`));
  await expect(page.getByTestId("confirm-total")).toContainText("2,400 ر.س");
  await page.getByLabel("الاسم", { exact: true }).fill("عميل قبل التغيير");
  await page.getByLabel("رقم الجوال", { exact: true }).fill(`05${String(Date.now()).slice(-8)}`);
  await page.getByLabel("رقم الجوال", { exact: true }).press("Enter");
  await expect(page).toHaveURL(ORDER_URL);
  const orderUrl = page.url();
  await expect(page.getByTestId("order-total")).toContainText("2,400 ر.س");

  // تغيير السعر على منتج منشور: مراجعة تعيد عرض القديم والجديد، ثم تأكيد
  await page.goto(planUrl(plan, "pricing"));
  await field(page, form.price).fill("2,650");
  await page.getByRole("button", { name: form.saveTerms }).click();
  const review = page.getByTestId("form-review");
  await expect(review).toContainText("2,400 ر.س");
  await expect(review).toContainText("2,650 ر.س");
  await expect(review).toContainText(PLANS.termsConfirm.pending);
  expect(await db.productVersion.count({ where: { productId: plan.id } })).toBe(1);
  await page.getByRole("button", { name: PLANS.termsConfirm.confirm }).click();
  await expectNotice(page, NOTICES.product_version_created);

  await page.goto(planPage);
  await expect(page.locator("#top")).toContainText("2,650 ر.س");
  // إنشاء الطلب أفرغ السلة: تُضاف الباقة من جديد فتُسعَّر بالنسخة السارية
  await page.goto(shop(planPage));
  await expect(page.locator("#top")).toContainText("2,650 ر.س");
  await page.locator("#top").getByRole("button", { name: "اشترِ الآن" }).click();
  await expect(page.getByTestId("order-total")).toContainText("2,650 ر.س");
  await page.goto(shop(`/checkout/${plan.slug}`));
  await expect(page.getByTestId("confirm-total")).toContainText("2,650 ر.س");
  // الطلب الذي أُنشئ قبل التغيير بلقطته المختومة، في صفحة العميل وفي القاعدة
  await page.goto(orderUrl);
  await expect(page.getByTestId("order-total")).toContainText("2,400 ر.س");
  const item = await db.orderItem.findFirstOrThrow({ where: { productId: plan.id } });
  expect(item.listPriceMinor).toBe(240_000);

  // الإخفاء: يخرج من الصفحات والخريطة والسلة وعرض السعر، والطلب المعلّق يبقى
  await page.goto(`${planUrl(plan)}/status?to=unpublish`);
  await expect(page.getByText(/له الآن 1 من الطلبات المعلّقة/)).toBeVisible();
  await confirmStatus(page, plan, "unpublish");
  expect(await statusOf(page, planPage)).toBe(404);
  expect(await statusOf(page, `/en${planPage}`)).toBe(404);
  expect(await sitemap(page)).not.toContain(planPage);
  await page.goto("/memberships");
  await expect(page.getByText(names.nameAr)).toHaveCount(0);
  await page.goto(shop("/cart"));
  await expect(page.getByRole("heading", { name: "سلتك فارغة" })).toBeVisible();
  expect(await statusOf(page, shop(`/checkout/${plan.slug}`))).toBe(404);
  await page.goto(orderUrl);
  await expect(page.getByTestId("order-total")).toContainText("2,400 ر.س");
  expect(
    (await db.order.findFirstOrThrow({ where: { items: { some: { productId: plan.id } } } }))
      .status,
  ).toBe("pending_payment");
});

test("أرشفة آخر باقة تُباع تحتاج تأكيدًا صريحًا، والإضافة بلا رابط تُنبَّه عند النشر", async ({
  page,
}) => {
  const club = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const seed = { db, club, staff: owner };
  const only = await seedProduct(seed, PLAN);
  const draft = await seedProduct(seed, { ...PLAN, summaryEn: "" }, false);
  const addon = await seedProduct(
    seed,
    { kind: "addon", nameAr: "إضافة اختبار", nameEn: "Test add-on", price: "50" },
    false,
  );
  await signIn(page, owner);

  await page.goto(`${planUrl(only)}/status?to=archive`);
  await expect(page.getByText(PLANS.status.last)).toBeVisible();
  const confirm = page.getByLabel(PLANS.status.confirmLast);
  await expect(confirm).toHaveAttribute("required", "");
  // بلا الخانة لا يُنفَّذ: المتصفح يمنع الإرسال، والخادم يرفضه إن وصل
  await page.getByRole("button", { name: PLANS.status.submit.archive }).click();
  await expect(page).toHaveURL(/status\?to=archive$/);
  expect((await db.product.findUniqueOrThrow({ where: { id: only.id } })).status).toBe("active");
  await confirm.check();
  await page.getByRole("button", { name: PLANS.status.submit.archive }).click();
  await expectNotice(page, NOTICES.product_archived);
  const audit = await db.auditLog.findFirstOrThrow({
    where: { entityId: only.id, action: "product_archived" },
  });
  expect(audit).toMatchObject({ actor: `staff:${owner.id}`, data: { lastSellable: true } });

  // مسودة ناقصة النص: موانع النشر بدل الزر
  await page.goto(`${planUrl(draft)}/status?to=publish`);
  await expect(page.getByText(PLANS.status.blockers.texts_incomplete)).toBeVisible();
  await expect(page.getByRole("button", { name: PLANS.status.submit.publish })).toHaveCount(0);
  // إضافة بلا باقة مرتبطة: تنبيه لا منع
  await page.goto(`${planUrl(addon)}/status?to=publish`);
  await expect(page.getByText(PLANS.status.warnings.addon_unlinked)).toBeVisible();
  await expect(page.getByRole("button", { name: PLANS.status.submit.publish })).toBeVisible();
  // ربطها من صفحتها
  await page.goto(planUrl(addon));
  await page
    .getByLabel(new RegExp(`^${PLAN.nameAr}`))
    .first()
    .check();
  await page.getByRole("button", { name: PLANS.detail.saveLinks }).click();
  await expectNotice(page, NOTICES.product_addon_links_updated);
  expect(await db.productAddon.count({ where: { addonProductId: addon.id } })).toBe(1);
});
