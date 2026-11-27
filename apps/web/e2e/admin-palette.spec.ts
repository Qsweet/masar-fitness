import type { Db } from "@masar/db";
import { expect, test, type Page } from "@playwright/test";
import { newClub, newStaff, shell, signIn, TEXT } from "./admin-support";
import { testDb } from "./payments-support";

/**
 * لوحة الأوامر ⌘K والاختصارات وصفحة البحث (ADMIN_REDESIGN §4.3، §7، R1): نمط combobox/listbox،
 * والتركيز يعود بعد الإغلاق، والمدخلات بصلاحيات الموظف محسوبة على الخادم، والاختصارات بـevent.code.
 */
const DESKTOP_MIN = 1024;
const PALETTE = TEXT.shell.palette;

let db: Db;

test.beforeAll(() => {
  db = testDb();
});

test.afterAll(async () => {
  await db.$disconnect();
});

function palette(page: Page) {
  return page.getByRole("dialog", { name: PALETTE.title });
}

function combobox(page: Page) {
  return palette(page).getByRole("combobox", { name: PALETTE.input });
}

/** الاختصارات تعمل بعد أن يُحمَّل سكربت الهيكل: ننتظر سكون الشبكة قبل لوحة المفاتيح. */
async function hydrated(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

async function optionLabels(page: Page): Promise<string[]> {
  return palette(page).getByRole("option").locator("span > span:first-child").allTextContents();
}

test("⌘K يفتح اللوحة، والأسهم تنقل الخيار النشط، وEnter ينقل، وEsc يعيد التركيز", async ({
  page,
}) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await hydrated(page);
  await page.keyboard.press("Control+KeyK");
  await expect(palette(page)).toBeVisible();
  const input = combobox(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const listbox = palette(page).getByRole("listbox");
  await expect(input).toHaveAttribute("aria-controls", (await listbox.getAttribute("id")) ?? "");

  await input.fill("التدقيق");
  await expect(palette(page).getByRole("status")).toHaveText(
    PALETTE.results.replace("{count}", "1"),
  );
  const first = palette(page).getByRole("option").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await first.getAttribute("id")) ?? "",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(palette(page)).toBeHidden();

  // من زر البحث: Esc يغلق ويعيد التركيز إليه (على الهاتف أيقونة البحث)
  const trigger = page
    .getByRole("link", {
      name:
        (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN
          ? TEXT.shell.search
          : TEXT.shell.searchShort,
    })
    .first();
  await trigger.click();
  await expect(combobox(page)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const second = palette(page).getByRole("option").nth(1);
  await expect(second).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Ctrl+K يعمل على لوحة مفاتيح عربية (الموضع لا الحرف)", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await hydrated(page);
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyK", key: "ن", ctrlKey: true, bubbles: true }),
    );
  });
  await expect(palette(page)).toBeVisible();
});

test("Tab يبدّل النطاق، و«الأخيرة» تظهر بالبحث الفارغ", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { level: 1, name: TEXT.audit.title })).toBeVisible();
  await hydrated(page);
  await page.keyboard.press("Control+KeyK");
  const recent = palette(page).getByRole("group", { name: PALETTE.groups.recent });
  await expect(recent.getByRole("option").first()).toContainText(TEXT.nav.audit);
  await page.keyboard.press("Tab");
  await expect(palette(page).getByRole("button", { name: PALETTE.scopes.page })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(palette(page).getByRole("group", { name: PALETTE.groups.action })).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(palette(page).getByRole("group", { name: PALETTE.groups.page })).toHaveCount(0);
  await expect(palette(page).getByRole("option").first()).toBeVisible();
});

test("اللوحة بصلاحيات الموظف: المحرر والمبيعات لا يصلهم ما لا يملكونه أصلًا", async ({
  browser,
}) => {
  const club = await newClub(db);
  const expectations = {
    editor: {
      present: [TEXT.nav.contentTexts, TEXT.shell.actions.newSlide.label],
      absent: [TEXT.nav.orders, TEXT.shell.actions.newStaff.label, TEXT.nav.audit],
      hrefs: ["/admin/sales/orders", "/admin/staff/new"],
    },
    sales: {
      present: [TEXT.nav.orders, TEXT.shell.actions.findOrder.label],
      absent: [TEXT.nav.contentTexts, TEXT.shell.actions.newPlan.label, TEXT.nav.staff],
      hrefs: ["/admin/content/texts", "/admin/sales/plans/new", "/admin/staff/new"],
    },
  } as const;
  for (const role of ["editor", "sales"] as const) {
    const staff = await newStaff(db, club, { role, withTotp: true });
    const page = await (await browser.newContext()).newPage();
    await signIn(page, staff);
    // ما لا يملكه لا يُرسل إلى المتصفح أصلًا (ولا في حمولة المكوّنات)
    const html = await page.content();
    for (const href of expectations[role].hrefs) {
      expect(html, `${role} ${href}`).not.toContain(`"${href}"`);
    }
    await hydrated(page);
    await page.keyboard.press("Control+KeyK");
    const labels = await optionLabels(page);
    for (const label of expectations[role].present) {
      expect(labels, `${role} يرى ${label}`).toContain(label);
    }
    for (const label of expectations[role].absent) {
      expect(labels, `${role} لا يرى ${label}`).not.toContain(label);
    }
    await page.context().close();
  }
});

test("الاختصارات: G ثم O، و[ للطي، و/ لحقل البحث، و? للحوار، وتُطفأ", async ({ page }) => {
  const desktop = (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN;
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  await hydrated(page);
  await page.keyboard.press("KeyG");
  await page.keyboard.press("KeyO");
  await expect(page).toHaveURL(/\/admin\/sales\/orders$/);
  await hydrated(page);
  await page.keyboard.press("Slash");
  await expect(page.getByLabel(TEXT.sales.orders.filters.reference)).toBeFocused();
  // داخل الحقل لا يعمل اختصار بحرف
  await page.keyboard.press("KeyG");
  await page.keyboard.press("KeyH");
  await expect(page).toHaveURL(/\/admin\/sales\/orders$/);
  await page.locator("main h1").click();
  if (desktop) {
    await page.keyboard.press("BracketLeft");
    await expect(shell(page)).toHaveAttribute("data-collapsed", "");
    await page.keyboard.press("BracketLeft");
    await expect(shell(page)).not.toHaveAttribute("data-collapsed", "");
  }
  await page.keyboard.press("Shift+Slash");
  const help = page.getByRole("dialog", { name: TEXT.shell.shortcuts.title });
  await expect(help).toBeVisible();
  await help.getByRole("button", { name: TEXT.shell.shortcutsToggle.off }).click();
  await expect(help).toBeHidden();
  await page.keyboard.press("KeyG");
  await page.keyboard.press("KeyH");
  await expect(page).toHaveURL(/\/admin\/sales\/orders$/);
  // ⌘K يبقى يعمل والاختصارات مطفأة
  await page.keyboard.press("Control+KeyK");
  await expect(palette(page)).toBeVisible();
});

test("بلا JavaScript: زر البحث رابط لصفحة بحث تعمل وفيها الاختصارات", async ({ page }) => {
  const owner = await newStaff(db, await newClub(db), { withTotp: true });
  await signIn(page, owner);
  const searchLinks = page.locator('a[href="/admin/search"]');
  expect(await searchLinks.count()).toBeGreaterThan(0);
  await page.goto("/admin/search?q=orders");
  await expect(
    page.getByRole("heading", { level: 1, name: TEXT.shell.searchPage.title }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(`^${TEXT.nav.orders} `) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/sales\/orders$/);
  await page.goto("/admin/search#shortcuts");
  await expect(page.locator("#shortcuts")).toContainText(TEXT.shell.shortcuts.items.orders);
});
