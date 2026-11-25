import { expect, test } from "@playwright/test";

/** محتوى الرئيسية الحقيقي (docs/CLUB_FACTS.md): البرامج والأوقات والآراء والتواصل والتذييل. */

test.describe("البرامج", () => {
  test("أربع بطاقات: الأسعار من موقع النادي، والتأهيل بتنبيهه، وBE STRONG 45 بلا سعر", async ({
    page,
  }) => {
    await page.goto("/");
    const services = page.locator("#services");
    const cards = services.getByRole("listitem").filter({ has: page.getByRole("heading") });
    await expect(cards).toHaveCount(4);
    const training = cards.filter({ hasText: "التدريب الشخصي" });
    await expect(training).toContainText("من 8 إلى 30 حصة");
    await expect(training).toContainText("من 990 ر.س");
    await training.getByText("الباقات والأسعار").click();
    await expect(training).toContainText("2,999");
    const href = await training
      .getByRole("link", { name: "استفسر عبر واتساب" })
      .getAttribute("href");
    expect(new URL(href ?? "").searchParams.get("text")).toBe(
      "مرحبًا، أرغب في الاستفسار عن «التدريب الشخصي».",
    );
    await expect(cards.filter({ hasText: "تأهيل" })).toContainText("ليس علاجًا طبيعيًا");
    const beStrong = cards.filter({ hasText: "BE STRONG 45" });
    await expect(beStrong).toContainText("قيد الإعداد");
    await expect(beStrong.getByRole("link")).toHaveCount(0);
    await expect(beStrong).not.toContainText("ر.س");
  });
});

test.describe("الأوقات والآراء", () => {
  test("ساعات النادي والمسبح كما في موقع النادي، في جدولين حقيقيين", async ({ page }) => {
    await page.goto("/");
    const hours = page.locator("#hours");
    const club = hours.getByRole("table", { name: "النادي" });
    await expect(club.getByRole("row")).toHaveText([
      /السبت – الخميس\s*6:00 ص – 2:00 ص/,
      /الجمعة\s*1:00 م – 12:00 ص/,
    ]);
    const pool = hours.getByRole("table", { name: "المسبح" });
    await expect(pool.getByRole("row")).toHaveText([
      /السبت – الخميس\s*8:00 ص – 11:30 م/,
      /الجمعة\s*3:00 م – 9:00 م/,
    ]);
    await expect(hours).not.toContainText("رمضان");
  });

  test("تقييم Google بمصدره، وثلاثة آراء بنصها واسم صاحبها بلا صور", async ({ page }) => {
    await page.goto("/");
    const reviews = page.locator("section", {
      has: page.getByRole("heading", { name: "ماذا يقول أعضاؤنا" }),
    });
    await expect(reviews).toContainText("4.5");
    await expect(reviews).toContainText("من 1,841 مراجعة");
    await expect(reviews).toContainText("كما عرضه موقع النادي");
    await expect(reviews.locator("blockquote")).toHaveCount(3);
    await expect(reviews).toContainText("مسعود الحربي");
    await expect(reviews.locator("img")).toHaveCount(0);
  });
});

test.describe("التواصل والتذييل", () => {
  test("النموذج يفتح واتساب برسالة جاهزة ولا يرسل شيئًا إلى الخادم", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") {
        posts.push(request.url());
      }
    });
    await page.route("https://wa.me/**", (route) => route.fulfill({ status: 200, body: "ok" }));
    await page.goto("/");
    const form = page.locator("#contact form");
    await form.getByLabel("الاسم").fill("سعد");
    await form.getByLabel("ما الذي يهمك؟").selectOption({ label: "تعليم السباحة" });
    const [request] = await Promise.all([
      page.waitForRequest(/^https:\/\/wa\.me\//),
      form.getByRole("button", { name: "أرسل عبر واتساب" }).click(),
    ]);
    const url = new URL(request.url());
    expect(url.pathname).toBe("/966553240111");
    expect(url.searchParams.get("text")).toBe("مرحبًا، أنا سعد.\nأستفسر عن: تعليم السباحة.");
    expect(posts).toEqual([]);
  });

  test("الخريطة رابط إلى Google بلا تضمين، والهاتف والبريد", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("#contact");
    await expect(contact.locator("iframe")).toHaveCount(0);
    await expect(contact.getByRole("link", { name: "افتح الخريطة" })).toHaveAttribute(
      "href",
      /google\.com\/maps\/dir\/\?api=1&destination=26\.4077931/,
    );
    await expect(contact.getByRole("link", { name: "Mmastersway@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:Mmastersway@gmail.com",
    );
  });

  test("التذييل: السجل التجاري كما في موقع النادي، والحسابات الأربعة، والسطر الصادق", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("السجل التجاري 7003597346");
    await expect(footer.getByRole("list", { name: "حساباتنا" }).getByRole("link")).toHaveCount(4);
    await expect(footer.getByRole("link", { name: "إنستجرام" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/Mmastersway",
    );
    await expect(footer).toContainText("الاشتراك حاليًا عبر واتساب النادي");
  });

  test("زر المحادثة العائم يفتح واتساب النادي", async ({ page }) => {
    await page.goto("/memberships");
    const href = await page.getByRole("link", { name: "راسلنا على واتساب" }).getAttribute("href");
    expect(new URL(href ?? "").origin).toBe("https://wa.me");
  });
});
