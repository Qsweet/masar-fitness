import { expect, test } from "@playwright/test";

/** محتوى الرئيسية الحقيقي (docs/CLUB_FACTS.md): البرامج والأوقات والآراء والتواصل والتذييل. */

test.describe("البرامج", () => {
  test("ثلاث بطاقات بأسعار موقع النادي، والتأهيل بتنبيهه، وBE STRONG 45 سطر «قيد الإعداد» لا بطاقة", async ({
    page,
  }) => {
    await page.goto("/");
    const services = page.locator("#services");
    const cards = services.getByRole("listitem").filter({ has: page.getByRole("heading") });
    await expect(cards).toHaveCount(3);
    const training = cards.filter({ hasText: "التدريب الشخصي" });
    await expect(training).toContainText("من 8 إلى 30 حصة");
    // أقل سعر للتدريب الشخصي غير محسوم (مجموعتان في موقع النادي): لا «من … ر.س»
    await expect(training).not.toContainText("من 990");
    await training.getByText("الباقات والأسعار").click();
    await expect(training).toContainText("2,999");
    const href = await training
      .getByRole("link", { name: "استفسر عبر واتساب" })
      .getAttribute("href");
    expect(new URL(href ?? "").searchParams.get("text")).toBe(
      "مرحبًا، أرغب في الاستفسار عن «التدريب الشخصي».",
    );
    const rehab = cards.filter({ hasText: "تأهيل" });
    await expect(rehab).toContainText("ليس علاجًا طبيعيًا");
    await expect(rehab).toContainText("من 720 ر.س");
    await expect(cards.filter({ hasText: "BE STRONG 45" })).toHaveCount(0);
    await expect(services).toContainText("قيد الإعداد: BE STRONG 45");
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

  test("التذييل: لا رقم سجل قبل تأكيد المالك، والعنوان الظاهر، والحسابات الأربعة، والسطر الصادق", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).not.toContainText("7003597346");
    await expect(footer).toContainText("4870 الطريق الدائري الشمالي، 8177");
    await expect(footer).not.toContainText("الغربي");
    await expect(footer.getByRole("list", { name: "حساباتنا" }).getByRole("link")).toHaveCount(4);
    await expect(footer.getByRole("link", { name: "إنستجرام" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/Mmastersway",
    );
    await expect(footer).toContainText("الاشتراك حاليًا عبر واتساب النادي");
  });

  test("زر المحادثة العائم يفتح واتساب النادي، وعلى الهاتف ينتقل إلى الشريط الثابت", async ({
    page,
    viewport,
  }) => {
    await page.goto("/memberships");
    const chat = page.getByRole("link", { name: "راسلنا على واتساب" });
    if ((viewport?.width ?? 0) < 768) {
      // لا زر عائم فوق نص الواجهة: واتساب في الشريط الثابت حين يظهر
      await expect(chat).toHaveCount(0);
      await page.locator("#compare").scrollIntoViewIfNeeded();
      const bar = page.getByRole("complementary", { name: "ملخص الاشتراك" });
      await expect(bar.getByRole("link", { name: "راسلنا على واتساب" })).toBeVisible();
    }
    const href = await page
      .getByRole("link", { name: "راسلنا على واتساب" })
      .first()
      .getAttribute("href");
    expect(new URL(href ?? "").origin).toBe("https://wa.me");
  });

  test("الصفحات بلا قسم اشتراكات: شريط هاتف ثابت بـ«اختر اشتراكك» وواتساب", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) >= 768, "الشريط خاص بالهاتف");
    await page.goto("/tools/cost-per-visit");
    const bar = page.getByRole("complementary", { name: "اختصارات الاشتراك والتواصل" });
    // مخفي ما دام رأس الصفحة ظاهرًا، ويظهر بعده
    await expect(bar).toBeHidden();
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await expect(bar.getByRole("link", { name: "اختر اشتراكك" })).toHaveAttribute(
      "href",
      "/memberships",
    );
    const whatsapp = bar.getByRole("link", { name: "راسلنا على واتساب" });
    const box = await whatsapp.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  });
});
