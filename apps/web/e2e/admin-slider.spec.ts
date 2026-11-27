import type { Db } from "@masar/db";
import { expect, test } from "@playwright/test";
import {
  createSlide,
  fillSlide,
  MEDIA,
  PHOTO,
  PHOTO_2,
  SLIDER,
  uploadPhoto,
} from "./admin-slider-support";
import { newClub, newStaff, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * الشريط والمكتبة في نادي اختبار (ADMIN_A3_SLIDER §11، §13): الرفع بأسبابه، والشريحة بتحققها، والترتيب،
 * والقفل المتفائل، وصلاحيات المحرر والمالك، ومنع حذف صورة مستعملة. الموقع العام في content-slider.spec.ts.
 */
let db: Db;
const ERRORS = TEXT.errors;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("المحرر: رفع بأسبابه، ثم شريحة بتحقق الرابط، ثم ترتيب، ولا نشر له", async ({ page }) => {
  test.slow();
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "editor", withTotp: true }));

  await page.goto("/admin/content/media");
  await expect(page.getByTestId("no-backup")).toContainText(MEDIA.noBackupTitle);
  const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='2000' height='2000'/>");
  await page
    .getByLabel(MEDIA.file)
    .setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: svg });
  await page.getByRole("button", { name: MEDIA.submit, exact: true }).click();
  await expect(page.getByText(ERRORS["media.type_unsupported"])).toBeVisible();

  const id = await uploadPhoto(page, PHOTO);
  await expect(page.getByText(TEXT.notices.media_asset_uploaded)).toBeVisible();
  await expect(page.getByText("2400×1350")).toBeVisible();
  await expect(page.getByText(MEDIA.asset.deleteOwner)).toBeVisible();
  expect(await uploadPhoto(page, PHOTO)).toBe(id);
  await expect(page.getByText(TEXT.notices.media_asset_exists)).toBeVisible();
  await uploadPhoto(page, PHOTO_2);

  await page.goto("/admin/content/slider");
  await expect(page.getByText(SLIDER.list.emptyTitle)).toBeVisible();
  await page.getByRole("link", { name: SLIDER.list.new }).click();
  await fillSlide(page, {
    photo: "trainer-portrait.jpg",
    title: { ar: "تدرّب مع الأفضل", en: "Train with the best" },
    external: "javascript:alert(1)",
  });
  await page.getByRole("button", { name: SLIDER.form.create }).click();
  await expect(page.getByText(ERRORS["slider.link_https_only"])).toBeVisible();
  await page.getByLabel(SLIDER.form.external).fill("https://example.com/club");
  await page.getByLabel(SLIDER.form.clickTargets.slide).check();
  await page.getByRole("button", { name: SLIDER.form.create }).click();
  await expect(page.getByText(TEXT.notices.content_slide_created)).toBeVisible();

  await createSlide(page, {
    photo: "lat-pulldown.jpg",
    title: { ar: "اشتراكات بمدد واضحة", en: "Clear membership terms" },
    cta: { ar: "الاشتراكات", en: "Memberships" },
    internal: "/memberships",
  });
  const rows = page.getByTestId("slide-list").getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("تدرّب مع الأفضل");
  await expect(rows.first()).toContainText(SLIDER.statuses.live);
  await page.getByRole("button", { name: "انقل اشتراكات بمدد واضحة إلى أعلى" }).click();
  await expect(page.getByText(TEXT.notices.content_slide_moved)).toBeVisible();
  await expect(rows.first()).toContainText("اشتراكات بمدد واضحة");

  await page.goto("/admin/content");
  await expect(page.getByTestId("slider-diff")).toContainText(SLIDER.diff.kinds.added);
  await expect(page.getByRole("link", { name: TEXT.content.overview.publish })).toHaveCount(0);
  const response = await page.goto("/admin/content/publish");
  expect(response?.status()).toBe(404);
});

test("قفل متفائل: تعديلان من نسختين قديمتين يمر أولهما ويُرفض الثاني", async ({ page }) => {
  test.slow();
  const club = await newClub(db);
  const staff = await newStaff(db, club, { role: "manager", withTotp: true });
  await signIn(page, staff);
  await uploadPhoto(page, PHOTO);
  await createSlide(page, { photo: "trainer-portrait.jpg", title: { ar: "أول", en: "First" } });
  await page.getByTestId("slide-list").getByRole("link", { name: "أول", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/slider\/[0-9a-f-]{36}$/);
  const editUrl = page.url();
  const other = await page.context().newPage();
  await other.goto(editUrl);
  await expect(other.getByTestId("slide-preview")).toBeVisible();

  await page
    .getByLabel(`${SLIDER.form.fields.title} · ${TEXT.content.locales.ar}`, { exact: true })
    .fill("ثانٍ");
  await page.getByRole("button", { name: SLIDER.form.save }).click();
  await expect(page.getByText(TEXT.notices.content_slide_updated)).toBeVisible();
  await other
    .getByLabel(`${SLIDER.form.fields.title} · ${TEXT.content.locales.ar}`, { exact: true })
    .fill("ثالث");
  await other.getByRole("button", { name: SLIDER.form.save }).click();
  await expect(other.getByText(ERRORS["slider.stale_edit"])).toBeVisible();
  await other.close();
});

test("المالك: صورة مستعملة لا تُحذف، وغير المستعملة تُحذف نهائيًا", async ({ page }) => {
  test.slow();
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "owner", withTotp: true }));
  const used = await uploadPhoto(page, PHOTO);
  const unused = await uploadPhoto(page, PHOTO_2);
  await createSlide(page, { photo: "trainer-portrait.jpg", title: { ar: "عرض", en: "Offer" } });

  await page.goto(`/admin/content/media/${used}`);
  await expect(page.getByText(MEDIA.asset.deleteBlocked)).toBeVisible();
  await expect(page.getByRole("button", { name: MEDIA.asset.deleteSubmit })).toHaveCount(0);
  await page.goto(`/admin/content/media/${unused}`);
  await page.getByRole("button", { name: MEDIA.asset.deleteSubmit }).click();
  await expect(page.getByText(TEXT.notices.media_asset_deleted)).toBeVisible();
  await expect(page.getByTestId("media-grid").getByRole("listitem")).toHaveCount(1);
  expect((await page.goto(`/admin/content/media/${unused}`))?.status()).toBe(404);
});

test("صورة مسودة لا تُخدَّم للزائر، وتُخدَّم للموظف بلا تخزين", async ({ browser, page }) => {
  const club = await newClub(db);
  await signIn(page, await newStaff(db, club, { role: "editor", withTotp: true }));
  await uploadPhoto(page, PHOTO);
  const src = await page.locator("main picture img").first().getAttribute("src");
  expect(src).toMatch(/^\/api\/media\/[0-9a-f]{64}\/w\d+\.webp$/);
  const staffResponse = await page.request.get(src ?? "");
  expect(staffResponse.status()).toBe(200);
  expect(staffResponse.headers()["cache-control"]).toBe("private, no-store");
  expect(staffResponse.headers()["x-content-type-options"]).toBe("nosniff");
  const visitor = await browser.newContext();
  const anonymous = await visitor.request.get(new URL(src ?? "", page.url()).toString());
  expect(anonymous.status()).toBe(404);
  const traversal = await visitor.request.get(
    new URL("/api/media/..%2F..%2Fetc/passwd", page.url()).toString(),
  );
  expect(traversal.status()).toBe(404);
  await visitor.close();
});
