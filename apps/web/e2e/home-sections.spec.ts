import { expect, test, type Page } from "@playwright/test";

/** أقسام الرئيسية بلغة قالب «نبض» (القرار 49): الواجهة والمرافق والأسعار. البيانات من بذرة المعاينة. */
const ANNUAL = { slug: "one-year" };
const FACILITY_CARDS = [
  "صالة الحديد",
  "التمارين الوظيفية",
  "الحصص الجماعية",
  "المسبح",
  "الساونا والجاكوزي والبخار",
];
/** مزايا الاشتراك بأسماء شروط النادي الحالية، وهي نفسها أسماء المرافق. */
const BENEFITS = [
  "صالة الحديد",
  "التمارين الوظيفية",
  "الحصص الجماعية",
  "المسبح",
  "الجاكوزي",
  "الساونا",
  "البخار",
];

function durations(page: Page) {
  return page.getByRole("group", { name: "مدة الاشتراك" });
}

function summary(page: Page) {
  return page.locator("#plans [aria-live]");
}

test.describe("الواجهة", () => {
  test("عنوان الصفحة بالفصحى يسمّي النادي والمدينة، وسطره الثاني شعار الجدار", async ({ page }) => {
    await page.goto("/");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toContainText("نادي مسار الأبطال الرياضي للرجال في بريدة");
    await expect(title).toContainText("أنت قدها.");
    await expect(page.locator("#top")).not.toContainText("جدار");
  });

  test("رقائق الحقائق من موقع النادي فقط: التأسيس والتقييم وللرجال، بلا أعداد أعضاء", async ({
    page,
  }) => {
    await page.goto("/");
    const hero = page.locator("#top");
    await expect(hero).toContainText("2018");
    await expect(hero).toContainText("4.5");
    await expect(hero).toContainText("تقييم Google");
    await expect(hero).toContainText("18+");
    await expect(hero).toContainText("للرجال فقط");
    // شارة العرض محسوبة من الكتالوج (مكافأة الاشتراك الأوفر شهريًا)، والساعات من الإعداد
    await expect(hero).toContainText("+ شهران مجانًا");
    await expect(hero).toContainText("6:00 ص – 2:00 ص");
    await expect(hero).not.toContainText(/عضو|%/);
  });
});

test.describe("المرافق", () => {
  test("خمس بطاقات بصور النادي، والمسبح بمرساته وعمقه، وكلها ضمن الاشتراك", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#facilities");
    // لا عدد في السطر التعريفي، ولا بطاقة بلا صورة
    await expect(section).toContainText("مرافق النادي كلها ضمن اشتراكك.");
    await expect(section.locator("li img")).toHaveCount(FACILITY_CARDS.length);
    await expect(section.getByRole("heading", { level: 3 })).toHaveText(FACILITY_CARDS);
    await expect(section.locator("#water")).toContainText("متدرج العمق");
    await expect(section.locator("#water")).toContainText("عمق من 1.5 إلى 3.5 متر");
    await expect(section.getByText("ضمن الاشتراك")).toHaveCount(FACILITY_CARDS.length);
  });

  test("مزايا صفحة الاشتراك بأسماء المرافق نفسها، والملخص يختصرها في سطر", async ({ page }) => {
    await page.goto("/");
    // المزايا متطابقة: سطر واحد في كل بطاقة، والملخص لا يكررها
    await expect(durations(page).locator("label").first()).toContainText("يشمل جميع مرافق النادي");
    await expect(summary(page).getByRole("listitem")).toHaveCount(0);
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const benefits = page.locator("section", {
      has: page.getByRole("heading", { name: "يشمل الاشتراك" }),
    });
    await expect(benefits.getByRole("listitem")).toHaveText(BENEFITS);
  });

  test("مع تقليل الحركة: الأقسام ظاهرة كاملة بلا حركة دخول", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const card = page.locator("#facilities li").last();
    await expect(card).toHaveCSS("opacity", "1");
    await expect(card).toHaveCSS("animation-name", "none");
  });
});

test.describe("بطاقات الأسعار", () => {
  test("طرق الدفع لا تُعرض والشراء الإلكتروني مغلق: سطر واحد صادق بجانب زر واتساب", async ({
    page,
  }) => {
    for (const [path, offer] of [
      ["/", "#plans [aria-live]"],
      ["/memberships", "#plans [aria-live]"],
      [`/memberships/${ANNUAL.slug}`, "#top"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "طرق الدفع" }), path).toHaveCount(0);
      await expect(page.locator(offer), path).toContainText(
        "الدفع الإلكتروني المباشر قيد التجهيز. الاشتراك حاليًا عبر واتساب النادي.",
      );
    }
  });

  test("كل بطاقة: المدة كاملة والإجمالي والشهري والتجميد (5 أيام لكل شهر مدفوع)", async ({
    page,
  }) => {
    await page.goto("/");
    const cards = durations(page).locator("label");
    await expect(cards).toHaveCount(3);
    // الأوفر شهريًا (12 شهرًا) في الوسط
    await expect(cards.nth(0)).toContainText("4 أشهر، منها شهر مجانًا");
    await expect(cards.nth(0)).toContainText("تجميد حتى 15 يومًا");
    await expect(cards.nth(1)).toContainText("تجميد حتى 60 يومًا");
    await expect(cards.nth(2)).toContainText("999");
    await expect(cards.nth(2)).toContainText("تجميد حتى 30 يومًا");
    for (const card of await cards.all()) {
      await expect(card).toContainText("يبدأ من تاريخ التفعيل في النادي");
    }
  });

  test("عرض الأصدقاء تحت البطاقات: السعر للثلاثة وحصة الشخص، والحجز عبر واتساب", async ({
    page,
  }) => {
    await page.goto("/");
    const friends = page.locator("#friends");
    await expect(friends).toContainText("3,999");
    await expect(friends).toContainText("1,333 ر.س للشخص");
    const href = await friends.getByRole("link").getAttribute("href");
    expect(new URL(href ?? "").origin).toBe("https://wa.me");
  });
});
