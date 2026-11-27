import AxeBuilder from "@axe-core/playwright";
import type { Db } from "@masar/db";
import { parseRange } from "@masar/domain";
import { expect, test, type Page } from "@playwright/test";
import { seedSales } from "./admin-overview-support";
import { newClub, newStaff, setTheme, signIn, TEXT, type Club } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * «نظرة عامة» v2 (ADMIN_REDESIGN §5.1، R2): قبل البيع قائمة الإطلاق من حالة النظام، ومع الطلبات مؤشرات
 * الفترة ورسومها. الفترة في الرابط، وكل قسم بصلاحيته، وaxe بلا مخالفة في المظهرين.
 */
const OVERVIEW = TEXT.overview;
const RIYADH = "Asia/Riyadh";
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

function checklistItem(page: Page, item: string) {
  return page.getByTestId("launch-checklist").locator(`[data-item="${item}"]`);
}

test("قبل البيع: قائمة الإطلاق من الحالة الفعلية، وأصفار بسببها، وإجراءات سريعة", async ({
  page,
}) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true, displayName: "خالد" });
  await signIn(page, owner);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("أهلًا خالد");
  const checklist = page.getByTestId("launch-checklist");
  await expect(checklist).toBeVisible();
  // نادي الاختبار حسم إعدادات البيع، والمالك سجّل الخطوتين: مكتملان رقيقتين
  await expect(checklistItem(page, "salesSettings")).toHaveClass(/chip/);
  await expect(checklistItem(page, "mfa")).toHaveClass(/chip/);
  await expect(checklistItem(page, "plans")).toHaveAttribute("data-state", "todo");
  await expect(checklistItem(page, "payments")).toHaveAttribute("data-state", "later");
  await expect(checklistItem(page, "checkout")).toHaveAttribute("data-state", "owner");
  await expect(checklistItem(page, "backup")).toHaveAttribute("data-state", "todo");
  await expect(checklistItem(page, "plans").getByRole("link")).toHaveAttribute(
    "href",
    "/admin/sales/plans/new",
  );
  // التحية والبطاقة تقولان الجملة نفسها على البنود الثمانية
  const sentence = (await checklist.locator("h2 + p").textContent()) ?? "";
  expect(sentence).toContain("اكتمل 2 من 8");
  await expect(page.locator("main header p").nth(1)).toContainText(sentence);
  await expect(checklistItem(page, "payments")).toContainText(OVERVIEW.launch.states.later);
  await expect(checklist).not.toContainText("A6");
  await expect(checklist).not.toContainText("docs/");
  await expect(page.getByTestId("kpi-completion-value")).toHaveText("—");
  await expect(page.getByTestId("kpi-revenue")).toContainText(OVERVIEW.kpis.startsWithFirstOrder);
  await expect(page.getByTestId("kpi-paid-value")).toHaveText("0");
  await expect(page.getByTestId("revenue-chart")).toHaveCount(0);
  await expect(page.getByTestId("quick-actions").getByRole("link")).toHaveCount(5);
});

test("كل بند يتغير بحالته الحقيقية وحدها: إعدادات بيع غير محسومة", async ({ page }) => {
  const club = await newClub(db, { orderPaymentWindowMinutes: null });
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  await expect(checklistItem(page, "salesSettings")).toHaveAttribute("data-state", "todo");
  await expect(checklistItem(page, "salesSettings").getByRole("link")).toHaveAttribute(
    "href",
    "/admin/sales/settings",
  );
  await expect(checklistItem(page, "mfa")).toHaveClass(/chip/);
});

test("المدير يرى البنود الثمانية نفسها، وما لا يفعله «بيد المالك» بلا زر", async ({ page }) => {
  const club = await newClub(db);
  // موظف بلا تحقق بخطوتين: البند مفتوح، وفعله (الموظفون) للمالك وحده
  await newStaff(db, club, { role: "sales" });
  await signIn(page, await newStaff(db, club, { role: "manager", withTotp: true }));
  const mfa = checklistItem(page, "mfa");
  await expect(mfa).toHaveAttribute("data-state", "todo");
  await expect(mfa.getByRole("link")).toHaveCount(0);
  await expect(mfa).toContainText(OVERVIEW.launch.states.ownerHand);
  await expect(page.getByTestId("launch-checklist").locator("h2 + p")).toContainText("من 8");
  await expect(page.getByTestId("launch-checklist").locator("h2 + p")).toContainText(
    OVERVIEW.launch.summary.owner.replace("{steps}", OVERVIEW.steps.one),
  );
  await expect(checklistItem(page, "plans").getByRole("link")).toHaveCount(1);
});

test("رابط معدَّل بتاريخ قديم جدًّا لا يُسقط الصفحة: الافتراضي مع سببه", async ({ page }) => {
  await signIn(page, await newStaff(db, await newClub(db), { withTotp: true }));
  for (const query of ["from=0001-01-01&to=0001-01-05", "from=0000-01-01&to=0000-01-01"]) {
    await page.goto(`/admin?${query}`);
    await expect(
      page.getByRole("status").filter({ hasText: OVERVIEW.range.issues.too_early }),
    ).toBeVisible();
    await expect(page.getByTestId("kpi-revenue")).toBeVisible();
  }
  await expect(page.getByLabel(OVERVIEW.range.from, { exact: true })).toHaveAttribute(
    "min",
    "2020-01-01",
  );
});

async function seededClub(): Promise<Club> {
  const club = await newClub(db);
  await seedSales(db, club.id, new Date());
  return club;
}

test("مع الطلبات: المؤشرات تطابق القاعدة، والرسم والاشتراكات والقمع، وبلا جوال كامل", async ({
  page,
}) => {
  const club = await seededClub();
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  const { range } = parseRange({}, new Date(), RIYADH);
  const paid = await db.order.count({
    where: { clubId: club.id, paidAt: { gte: range.start, lte: new Date() } },
  });
  await expect(page.getByTestId("kpi-paid-value")).toHaveText(String(paid));
  await expect(page.getByTestId("kpi-awaiting-value")).toHaveText("1");
  await expect(page.getByTestId("revenue-chart")).toBeVisible();
  await expect(page.getByTestId("plan-sales").locator("li")).toHaveCount(3);
  await expect(page.getByTestId("order-funnel")).toContainText(OVERVIEW.funnel.steps.paid);
  await expect(page.getByTestId("recent-orders").locator("tbody tr")).toHaveCount(5);
  const html = await page.content();
  expect(html).not.toMatch(/\+9665\d{8}/);
});

test("الفترة في الرابط: مقطع، ومدى مخصص، ومرفوض بلطف", async ({ page }) => {
  const club = await seededClub();
  await signIn(page, await newStaff(db, club, { withTotp: true }));
  const range = page.getByRole("navigation", { name: OVERVIEW.range.label });
  await expect(range.getByRole("link", { name: OVERVIEW.range.presets["30d"] })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await range.getByRole("link", { name: OVERVIEW.range.presets["7d"] }).click();
  await expect(page).toHaveURL(/\/admin\?range=7d$/);
  await expect(range.getByRole("link", { name: OVERVIEW.range.presets["7d"] })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.reload();
  await expect(page.getByRole("main")).toContainText(OVERVIEW.range.describe["7d"]);

  await page.getByText(OVERVIEW.range.custom).click();
  await page.getByLabel(OVERVIEW.range.from, { exact: true }).fill("2026-11-01");
  await page.getByLabel(OVERVIEW.range.to, { exact: true }).fill("2026-11-10");
  await page.getByRole("button", { name: OVERVIEW.range.apply }).click();
  await expect(page).toHaveURL(/from=2026-11-01&to=2026-11-10/);
  await expect(range.locator('[aria-current="true"]')).toHaveCount(0);

  await page.goto("/admin?from=2026-11-10&to=2026-11-01");
  await expect(
    page.getByRole("status").filter({ hasText: OVERVIEW.range.issues.reversed }),
  ).toBeVisible();
  await expect(range.getByRole("link", { name: OVERVIEW.range.presets["30d"] })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("المبيعات يرى المؤشرات والطلبات لا قائمة الإطلاق ولا النظام، والمحرر يُحوَّل", async ({
  browser,
}) => {
  const club = await seededClub();
  const sales = await (await browser.newContext()).newPage();
  await signIn(sales, await newStaff(db, club, { role: "sales", withTotp: true }));
  await expect(sales.getByTestId("kpi-paid")).toBeVisible();
  await expect(sales.getByTestId("recent-orders")).toBeVisible();
  await expect(sales.getByTestId("launch-checklist")).toHaveCount(0);
  await expect(sales.getByTestId("system-status")).toHaveCount(0);
  await expect(sales.getByTestId("activity-feed")).toHaveCount(0);
  await sales.context().close();

  const editor = await (await browser.newContext()).newPage();
  await signIn(editor, await newStaff(db, club, { role: "editor", withTotp: true }));
  await editor.goto("/admin?range=7d");
  await expect(editor).toHaveURL(/\/admin\/content\/texts$/);
  await editor.context().close();
});

test("«نظرة عامة» بحالتيها بلا مخالفات وصول في المظهرين", async ({ page }) => {
  const club = await seededClub();
  const empty = await newClub(db);
  const owner = await newStaff(db, club, { withTotp: true });
  const lonely = await newStaff(db, empty, { withTotp: true });
  for (const [staff, name] of [
    [owner, "data"],
    [lonely, "launch"],
  ] as const) {
    await page.context().clearCookies();
    await signIn(page, staff);
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await page.goto("/admin");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      const summary = results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
      );
      expect(summary, `${name} ${theme}`).toEqual([]);
    }
  }
});
