import { expect, test } from "@playwright/test";

/**
 * خط نص اللوحة لا يُحمَّل مسبقًا في الموقع العام (القرار 94-1): لا في ترويسة Link ولا في تلميحات الصفحة،
 * والصفحة العامة لا تطلب ملفه. اللوحة تستعمله (يظهر في CSS قطعتها ويُنزَّل حين يُرسم نص عربي).
 */
const PLEX = /ibm_plex/i;

test("الصفحة الرئيسية العامة بلا IBM Plex محمّلًا مسبقًا ولا منزَّلًا", async ({ page }) => {
  const response = await page.request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers().link ?? "").not.toMatch(PLEX);
  expect(await response.text()).not.toMatch(PLEX);
  const fonts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "font") {
      fonts.push(request.url());
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(fonts.filter((url) => PLEX.test(url))).toEqual([]);
});
