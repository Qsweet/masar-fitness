import { expect, test, type Page } from "@playwright/test";

/** أقسام الرئيسية بعد التنقيح الثاني (القرار 48). البيانات من البذرة التجريبية. */
const ANNUAL = { slug: "one-year" };

function durations(page: Page) {
  return page.getByRole("group", { name: "مدة الاشتراك" });
}

function summary(page: Page) {
  return page.locator("#plans [aria-live]");
}

test.describe("الواجهة والمرافق", () => {
  const FACILITIES = ["صالة الحديد", "التمارين الوظيفية", "المسبح", "الجاكوزي", "البخار"];

  test("المرافق الخمسة بأسمائها في ثلاث بطاقات، وهي نفسها مزايا صفحة الاشتراك", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page.locator("#facilities");
    await expect(section.getByRole("heading", { level: 3 })).toHaveText([
      "صالة الحديد",
      "التمارين الوظيفية",
      "الماء والاستشفاء",
    ]);
    await expect(section.locator("#water").getByRole("listitem")).toHaveText(FACILITIES.slice(2));
    await expect(section.locator("#water")).toContainText("مسبح داخلي بمسارات للسباحة");
    // كل الاشتراكات المعروضة بالمزايا نفسها: الملخص يختصرها في سطر واحد بلا قائمة مكررة
    await expect(summary(page)).toContainText("يشمل جميع مرافق النادي");
    await expect(summary(page).getByRole("listitem")).toHaveCount(0);
    await page.goto(`/memberships/${ANNUAL.slug}`);
    const benefits = page.locator("section", {
      has: page.getByRole("heading", { name: "يشمل الاشتراك" }),
    });
    await expect(benefits.getByRole("listitem")).toHaveText(FACILITIES);
  });

  test("عنوان الصفحة بالفصحى يسمّي النادي والمدينة، وشعار الجدار سطر لا عنوان", async ({
    page,
  }) => {
    await page.goto("/");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toContainText("نادي مسار الأبطال الرياضي للرجال في بريدة");
    await expect(page.locator("#top").getByText("أنت قدها.")).toBeVisible();
    await expect(page.locator("#top")).not.toContainText("جدار");
  });

  test("طرق الدفع لا تُعرض والشراء الإلكتروني مغلق: سطر واحد صادق بجانب زر واتساب", async ({
    page,
  }) => {
    for (const path of ["/", "/memberships", `/memberships/${ANNUAL.slug}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "طرق الدفع" }), path).toHaveCount(0);
      await expect(summary(page), path).toContainText(
        "الدفع الإلكتروني المباشر قيد التجهيز. الاشتراك حاليًا عبر واتساب النادي.",
      );
    }
  });

  test("مربعات المدة بالبنية نفسها: رقم ووحدة، والشهر الواحد يُقرأ «شهر واحد»", async ({
    page,
  }) => {
    await page.goto("/");
    const monthly = durations(page).locator("label").first();
    await expect(monthly.locator("[aria-hidden]").filter({ hasText: "شهر" })).toHaveText("1شهر");
    await expect(monthly).toContainText("350");
    await expect(monthly).not.toContainText("شهريًا");
    await expect(durations(page).getByRole("radio", { name: /^شهر واحد/ })).toHaveValue(
      "one-month",
    );
    await expect(durations(page).getByRole("radio", { name: /^1 شهر/ })).toHaveCount(0);
  });

  test("مقطع قسم التمرين صامت ومتكرر، وزره يوقفه ويشغّله", async ({ page }) => {
    await page.goto("/");
    await page.locator("#train").scrollIntoViewIfNeeded();
    const video = page.locator("#train video");
    await expect(video).toHaveJSProperty("muted", true);
    await expect(video).toHaveAttribute("loop", "");
    const pause = page.getByRole("button", { name: "أوقف الفيديو" });
    await pause.click();
    await expect(video).toHaveJSProperty("paused", true);
    await page.getByRole("button", { name: "شغّل الفيديو" }).click();
    await expect(video).toHaveJSProperty("paused", false);
  });

  test("مع تقليل الحركة: الإطار وحده بلا فيديو ولا زر", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator("#train").scrollIntoViewIfNeeded();
    await expect(page.locator("#train img")).toHaveCount(3);
    await expect(page.locator("#train video")).toHaveCount(0);
    await expect(page.locator("#train button")).toHaveCount(0);
    await expect(page.locator("#top video")).toHaveCount(0);
  });
});
