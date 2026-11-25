import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

/**
 * مسار الشراء على الخادم الثاني (3101، العلم مفتوح) ببذرة المعاينة: الاشتراكات الثلاثة بأسعار النادي المؤقتة،
 * إضافة demo-addon بـ50 ر.س، وكوبون DEMO10 بخصم 10% (packages/db/prisma/seed-demo.ts).
 */
const LABELS = {
  ar: { name: "الاسم", mobile: "رقم الجوال", submit: "أكّد الطلب", buy: "اشترِ الآن" },
  en: { name: "Name", mobile: "Mobile number", submit: "Confirm order", buy: "Buy now" },
} as const;
type Locale = keyof typeof LABELS;
const ORDER_URL = /\/checkout\/orders\/[A-Za-z0-9_-]{43}$/;
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const NO_PAYMENT = /ادفع|دفع الآن|pay/i;

/** جوال سعودي عشوائي لكل طلب: حد الطلبات المعلّقة لكل عميل لا يتراكم بين التشغيلات. */
function randomMobile(): string {
  return `05${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

/** IP معلَن مختلف لكل اختبار: حدود المحاولات لكل عنوان لا تتراكم بين الاختبارات والمشاريع. */
function randomIp(): string {
  const octet = () => String(Math.floor(Math.random() * 254) + 1);
  return `10.${octet()}.${octet()}.${octet()}`;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

async function fillBuyer(page: Page, locale: Locale, mobile: string, name = "محمد الاختبار") {
  await page.getByLabel(LABELS[locale].name, { exact: true }).fill(name);
  await page.getByLabel(LABELS[locale].mobile, { exact: true }).fill(mobile);
}

function submit(page: Page, locale: Locale) {
  return page.getByRole("button", { name: LABELS[locale].submit });
}

async function expectNoPaymentButton(page: Page) {
  await expect(page.getByRole("button", { name: NO_PAYMENT })).toHaveCount(0);
  await expect(page.getByRole("link", { name: NO_PAYMENT })).toHaveCount(0);
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

/** يكرر طلب الإرسال نفسه مرتين على الشبكة (ضغطتان حقيقيتان) ويجمع وجهة التحويل لكل منهما. */
async function sendTwice(page: Page, path: string, destinations: string[]) {
  await page.route(
    (url) => url.pathname === path,
    async (route: Route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const first = await route.fetch({ maxRedirects: 0 });
      const second = await route.fetch({ maxRedirects: 0 });
      for (const response of [first, second]) {
        const headers = response.headers();
        destinations.push(headers["x-action-redirect"] ?? headers.location ?? "");
      }
      await route.fulfill({ response: second });
    },
  );
}

/** نص الرابط الأعلى عند نقطة قرب بداية الرابط من جهة النهاية (حيث يقع زر المحادثة العائم). */
async function topmostLinkText(page: Page, link: Locator): Promise<string> {
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  const point = [(box?.x ?? 0) + (box?.width ?? 0) * 0.1, (box?.y ?? 0) + (box?.height ?? 0) / 2];
  return page.evaluate(
    ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest("a")?.textContent ?? "",
    point,
  );
}

function tokenOf(destination: string): string {
  return /orders\/([A-Za-z0-9_-]{43})/.exec(destination)?.[1] ?? "";
}

/** الإرسالان وصلا الخادم فعلًا، وكلاهما حوّل إلى الطلب نفسه الذي انتهت إليه الصفحة. */
function expectSingleOrder(page: Page, destinations: readonly string[]) {
  expect(destinations).toHaveLength(2);
  expect([...new Set(destinations.map(tokenOf))]).toEqual([page.url().split("/").pop()]);
}

test.describe("الشراء والعلم مفتوح", () => {
  test("بالعربية: باقة ← سلة ← بيانات ← مراجعة، والإجمالي واحد في كل الخطوات", async ({ page }) => {
    const mobile = randomMobile();
    await page.goto("/memberships/one-year");
    const planSummary = page.locator("#top");
    await expect(planSummary).toContainText("1,499 ر.س");
    await planSummary.getByRole("button", { name: LABELS.ar.buy }).click();

    // السلة: ملاحظة «أُضيف» وشارة العدد والإجمالي من القاعدة ومساعدة واتساب
    await expect(page).toHaveURL(/\/cart\?note=added$/);
    await expect(page.getByRole("status").first()).toHaveText("أُضيف الاشتراك إلى سلتك.");
    await expect(page.getByRole("link", { name: "السلة، عنصر واحد" })).toBeVisible();
    await expect(page.getByTestId("order-total")).toContainText("1,499 ر.س");
    await expect(page.locator("[aria-current=step]")).toContainText("السلة");
    await expect(page.getByRole("link", { name: /راسلنا على واتساب/ }).first()).toBeVisible();
    await page.getByRole("link", { name: "أكمل الطلب" }).first().click();

    await expect(page).toHaveURL(/\/checkout\/one-year$/);
    await expect(page.getByTestId("order-total")).toContainText("1,499 ر.س");
    await expect(page.getByTestId("confirm-total")).toContainText("1,499 ر.س");
    await expect(page.getByText("منه ضريبة القيمة المضافة 15%")).toBeVisible();
    await expect(page.getByText("يبدأ الاشتراك من يوم الدفع.")).toBeVisible();
    await fillBuyer(page, "ar", mobile);
    await submit(page, "ar").click();

    await expect(page).toHaveURL(ORDER_URL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلبك محجوز");
    const reference = (await page.getByTestId("order-reference").textContent()) ?? "";
    expect(reference).toMatch(/^MSR-\d{7}$/);
    await expect(page.getByTestId("order-total")).toContainText("1,499 ر.س");
    await expect(page.getByText(`+966•••••••${mobile.slice(-2)}`)).toBeVisible();
    await expect(page.getByText(mobile.slice(1))).toHaveCount(0);
    await expect(page.getByText("الدفع الإلكتروني غير متاح بعد", { exact: false })).toBeVisible();
    const whatsapp = page.getByRole("link", { name: "أرسل رقم الطلب عبر واتساب" });
    expect(decodeURIComponent((await whatsapp.getAttribute("href")) ?? "")).toContain(reference);
    await expectNoPaymentButton(page);
    // الطلب أُنشئ ⇒ السلة فارغة
    await expect(page.getByRole("link", { name: "السلة، فارغة" })).toBeVisible();
  });

  test("السلة: اشتراك واحد يحل محله الثاني، والحذف يفرّغها، والفارغة تقود إلى العضويات", async ({
    page,
  }) => {
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "سلتك فارغة" })).toBeVisible();
    await expect(page.getByRole("link", { name: "السلة، فارغة" })).toBeVisible();
    await page.goto("/memberships/three-months");
    await page.locator("#top").getByRole("button", { name: LABELS.ar.buy }).click();
    await page.goto("/memberships/six-months");
    await page.locator("#top").getByRole("button", { name: LABELS.ar.buy }).click();
    await expect(page).toHaveURL(/\/cart\?note=added$/);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("6 أشهر");
    // كل زر «أكمل الطلب» الظاهر غير محجوب (لا زر محادثة عائم فوق شريط الهاتف)
    for (const link of await page.getByRole("link", { name: "أكمل الطلب" }).all()) {
      if (await link.isVisible()) {
        expect(await topmostLinkText(page, link)).toContain("أكمل الطلب");
      }
    }
    await expectAxeClean(page);
    await page.getByRole("button", { name: "احذف" }).click();
    await expect(page).toHaveURL(/\/cart\?note=removed$/);
    await expect(page.getByRole("heading", { name: "سلتك فارغة" })).toBeVisible();
  });

  test("بالإنجليزية مع إضافة وكوبون DEMO10: الخصم باسمه والإجمالي واحد", async ({ page }) => {
    await page.goto("/en/checkout/one-year");
    await page.getByRole("checkbox", { name: /Demo add-on/ }).check();
    await page.getByLabel("Discount coupon").fill("demo10");
    await page.getByRole("button", { name: "Update summary" }).click();

    await expect(page).toHaveURL(/addon=demo-addon/);
    // (1,499 + 50) − 10% = 1,394.10
    await expect(page.getByTestId("order-total")).toContainText("1,394.10 SAR");
    await expect(page.getByTestId("confirm-total")).toContainText("1,394.10 SAR");
    await expect(page.getByText("Coupon DEMO10")).toBeVisible();
    await fillBuyer(page, "en", randomMobile(), "Test Buyer");
    await submit(page, "en").click();

    await expect(page).toHaveURL(/^[^?]*\/en\/checkout\/orders\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your order is reserved");
    await expect(page.getByTestId("order-total")).toContainText("1,394.10 SAR");
    await expect(page.getByText("Demo add-on")).toBeVisible();
    await expect(page.getByText("Coupon DEMO10")).toBeVisible();
    await expectNoPaymentButton(page);
  });

  test("جوال خاطئ: الخطأ بجانب الحقل، والاسم محفوظ، والتركيز على ملخص الأخطاء", async ({
    page,
  }) => {
    await page.goto("/checkout/three-months");
    await fillBuyer(page, "ar", "12345", "سالم");
    await submit(page, "ar").click();

    const mobileField = page.getByLabel(LABELS.ar.mobile, { exact: true });
    await expect(mobileField).toHaveAttribute("aria-invalid", "true");
    await expect(mobileField).toHaveAttribute("aria-describedby", /mobile-error/);
    await expect(page.locator("#mobile-error")).toHaveText(
      "اكتب رقم جوال سعودي صحيحًا، مثل 05XXXXXXXX.",
    );
    await expect(page.getByLabel(LABELS.ar.name, { exact: true })).toHaveValue("سالم");
    await expect(page.getByRole("alert").filter({ hasText: "راجع ما يلي" })).toBeFocused();
    await expect(page).toHaveURL(/\/checkout\/three-months$/);
    await expectAxeClean(page);
  });

  test("كوبون غير صالح: نص عام على حقله، والسعر بلا خصم، ولا نموذج بيانات", async ({ page }) => {
    await page.goto("/checkout/three-months?coupon=NOPE123");
    const coupon = page.getByLabel("كوبون الخصم");
    await expect(coupon).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#coupon-message")).toHaveText(
      "لا يمكن استخدام هذا الكوبون لهذا الطلب. تأكد من كتابته أو أزله.",
    );
    await expect(page.getByTestId("order-total")).toContainText("699 ر.س");
    await expect(submit(page, "ar")).toHaveCount(0);

    await page.goto("/checkout/three-months?coupon=%21%21");
    await expect(page.locator("#coupon-message")).toHaveText(
      "صيغة الكوبون غير صحيحة: حروف إنجليزية وأرقام فقط.",
    );
  });

  test("ضغطتان على التأكيد ⇒ طلب واحد بمرجع واحد", async ({ page }) => {
    const destinations: string[] = [];
    await page.goto("/checkout/six-months");
    await sendTwice(page, "/checkout/six-months", destinations);
    await fillBuyer(page, "ar", randomMobile());
    await submit(page, "ar").dblclick();

    await expect(page).toHaveURL(ORDER_URL);
    expectSingleOrder(page, destinations);
  });

  test("صفحة المراجعة بلا axe مخالفات، ورمز غير معروف 404", async ({ page }) => {
    await page.goto("/en/checkout/three-months");
    await fillBuyer(page, "en", randomMobile(), "Test Buyer");
    await submit(page, "en").click();
    await expect(page).toHaveURL(ORDER_URL);
    await expectAxeClean(page);

    const missing = await page.goto(`/checkout/orders/${"B".repeat(43)}`);
    expect(missing?.status()).toBe(404);
    const product = await page.goto("/checkout/no-such-plan");
    expect(product?.status()).toBe(404);
  });
});

test.describe("الشراء وJavaScript معطَّل", () => {
  test.use({ javaScriptEnabled: false });

  test("الخيارات والخطأ والإنشاء تعمل بنماذج HTML عادية، والضغطتان طلب واحد", async ({ page }) => {
    await page.goto("/checkout/six-months");
    // بلا JavaScript لا يعمل فحص الثبات قبل النقر في Playwright؛ Enter إرسال ضمني حقيقي للنموذج
    await page.getByLabel("كوبون الخصم").fill("DEMO10");
    await page.getByLabel("كوبون الخصم").press("Enter");
    await expect(page).toHaveURL(/coupon=DEMO10/);
    // 999 − 10% = 899.10
    await expect(page.getByTestId("order-total")).toContainText("899.10 ر.س");

    await fillBuyer(page, "ar", "0000", "فهد");
    await page.getByLabel(LABELS.ar.mobile, { exact: true }).press("Enter");
    await expect(page.locator("#mobile-error")).toBeVisible();
    await expect(page.getByLabel(LABELS.ar.name, { exact: true })).toHaveValue("فهد");

    const destinations: string[] = [];
    await sendTwice(page, "/checkout/six-months", destinations);
    await page.getByLabel(LABELS.ar.mobile, { exact: true }).fill(randomMobile());
    await page.getByLabel(LABELS.ar.mobile, { exact: true }).press("Enter");
    await expect(page).toHaveURL(ORDER_URL);
    expectSingleOrder(page, destinations);
    await expect(page.getByTestId("order-total")).toContainText("899.10 ر.س");
    await expectNoPaymentButton(page);
  });
});

/** المقاسات السبعة المعتمدة (docs/TESTING.md)، مرة واحدة على مشروع سطح المكتب. */
const WIDTHS = [360, 390, 430, 768, 1024, 1440, 1920];
const HEIGHT = 900;
const SCREENS_DIR = "screens";
const SCREENS_PROJECT = "checkout-1440";

test("حد الجوال: ثلاثة طلبات، ثم سقف المعلّق، ثم «محاولات كثيرة» بلا طلب", async ({ page }) => {
  test.skip(test.info().project.name !== SCREENS_PROJECT, "مرة واحدة لكل تشغيل");
  const mobile = randomMobile();
  // MAX_PENDING_ORDERS_PER_CUSTOMER = 3 و MAX_CHECKOUT_SUBMITS_PER_MOBILE = 5 (config/checkout.ts)
  const expected = ["order", "order", "order", "pending", "pending", "throttled"] as const;
  const texts = {
    pending: "لديك طلبات بانتظار الدفع. أكملها أولًا أو راسلنا على واتساب.",
    throttled: "محاولات كثيرة في وقت قصير. انتظر بضع دقائق ثم حاول مرة أخرى، أو راسلنا على واتساب.",
  };
  for (const outcome of expected) {
    await page.goto("/checkout/three-months");
    await fillBuyer(page, "ar", mobile);
    await submit(page, "ar").click();
    if (outcome === "order") {
      await expect(page).toHaveURL(ORDER_URL);
    } else {
      await expect(page.locator("#form-error")).toHaveText(texts[outcome]);
    }
  }
});

async function captureWidths(page: Page, path: string, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `تمرير أفقي عند ${String(width)}: ${name}`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SCREENS_DIR}/${name}-${String(width)}.png`, fullPage: true });
  }
}

for (const [locale, prefix] of [
  ["ar", ""],
  ["en", "/en"],
] as const) {
  test(`${locale}: لقطات المقاسات السبعة لصفحتي البيانات والمراجعة بلا أخطاء`, async ({ page }) => {
    test.skip(test.info().project.name !== SCREENS_PROJECT, "اللقطات مرة واحدة لكل تشغيل");
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        problems.push(message.text());
      }
    });
    page.on("pageerror", (error) => problems.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });

    const checkoutPath = `${prefix}/checkout/one-year?addon=demo-addon&coupon=DEMO10`;
    await page.goto(checkoutPath);
    await fillBuyer(page, locale, randomMobile());
    await submit(page, locale).click();
    await expect(page).toHaveURL(ORDER_URL);
    const orderPath = new URL(page.url()).pathname;

    await captureWidths(page, checkoutPath, `${locale}-checkout`);
    await captureWidths(page, orderPath, `${locale}-order`);
    expect(problems).toEqual([]);
  });
}
