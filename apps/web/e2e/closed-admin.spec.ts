import { expect, test, type APIResponse } from "@playwright/test";

/**
 * اللوحة مغلقة بلا `ADMIN_SECRET_KEY` (docs/ADMIN_DESIGN.md §4.1): على الخادم الأساسي كل مسار لوحة
 * يرد 404 بصفحة «غير موجودة» العامة نفسها، ولا يُعرف من الرد أن اللوحة موجودة.
 */
const ADMIN_PATHS = ["/admin", "/admin/login", "/admin/staff", "/admin/audit", "/admin/anything"];

for (const path of ADMIN_PATHS) {
  test(`${path} يرد 404 واللوحة غير مضبوطة`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الصفحة غير موجودة");
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
}

const NONCE = /'nonce-([^']+)'/;

/**
 * الجسم بلا ما يتغير مع كل طلب (قيمة nonce من ترويسة السياسة)، وبمقطعه الأول موحَّدًا إلى الاسم نفسه.
 * لا يُستبدل الاسم بعلامة محايدة: حمولة موجّه Next في كل صفحة تسرد أسماء مسارات الجذر الثابتة، فالاسم
 * موجود في الجسمين أصلًا.
 */
async function comparable(response: APIResponse, segments: readonly string[]): Promise<string> {
  const nonce = NONCE.exec(response.headers()["content-security-policy"] ?? "")?.[1] ?? "";
  expect(nonce).not.toBe("");
  const body = (await response.text()).replaceAll(nonce, "NONCE");
  return segments.reduce((text, segment) => text.replaceAll(segment, "admin"), body);
}

/**
 * كل كتابة لاسم اللوحة (حروف كبيرة، ترميز بالنسبة المئوية) ترد ما يرده مسار مجهول بالشكل نفسه:
 * الحالة، وأسماء الترويسات كلها، والجسم. لا ‎x-middleware-rewrite‎ ولا صفحة 404 الخام من Next.
 */
const SPELLINGS = ["admin", "Admin", "ADMIN", "%61dmin", "%41DMIN", "a%64%4Din"];

for (const spelling of SPELLINGS) {
  test(`‎/${spelling}/login‎ يطابق مسارًا مجهولًا: الحالة وأسماء الترويسات والجسم`, async ({
    request,
  }) => {
    const unknownSegment = "x".repeat(spelling.length);
    const [closed, unknown] = await Promise.all([
      request.get(`/${spelling}/login`, { maxRedirects: 0 }),
      request.get(`/${unknownSegment}/login`, { maxRedirects: 0 }),
    ]);
    expect(closed.status()).toBe(404);
    expect(unknown.status()).toBe(404);
    expect(Object.keys(closed.headers()).sort()).toEqual(Object.keys(unknown.headers()).sort());
    expect(closed.headers()["x-middleware-rewrite"]).toBeUndefined();
    expect(closed.headers()["x-robots-tag"]).toBe(unknown.headers()["x-robots-tag"]);
    expect(closed.headers()["cache-control"]).toBe(unknown.headers()["cache-control"]);
    const closedBody = await comparable(closed, [spelling, decodeURIComponent(spelling)]);
    expect(closedBody).toBe(await comparable(unknown, [unknownSegment]));
  });
}

test("علامة الفتح الداخلية من العميل لا تفتح شيئًا", async ({ request }) => {
  const response = await request.get("/admin/login", {
    headers: { "x-masar-admin-open": "1" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain('type="password"');
});

test("إرسال نموذج إلى اللوحة المغلقة يرد 404", async ({ request }) => {
  const response = await request.post("/admin/login", {
    form: { email: "owner@example.test", password: "whatever-password" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
});

test("robots.txt وخريطة الموقع لا يذكران اللوحة وهي مغلقة", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).not.toContain("admin");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/admin");
});
