import { randomUUID } from "node:crypto";
import {
  createOrder,
  createProduct,
  createPromotion,
  getCatalogProduct,
  getPromotionDetail,
  markOrderPaid,
  setAddonLinks,
  setProductStatus,
  setPromotionStatus,
  staffActor,
  type Db,
} from "@masar/db";
import {
  orderInput,
  productDraft,
  promotionDraft,
  testBuyer,
  testSlug,
  unwrap,
  type TestStaff,
} from "@masar/db/test-support";
import type { ProductDraftInput, PromotionDraftInput } from "@masar/domain";
import { expect, type Locator, type Page } from "@playwright/test";
import { randomE164 } from "./admin-sales-support";
import { TEXT, type Club } from "./admin-support";

/**
 * عدّة اختبارات الكتالوج والعروض في اللوحة: منتجات وعروض تُنشأ بطبقة الإدارة نفسها (نسخة وتدقيق)،
 * وطلبات حقيقية بكوبون. الأسماء والأسعار قيم اختبار لا قرارات المالك.
 */
export const PLANS = TEXT.sales.plans;
export const PROMOTIONS = TEXT.sales.promotions;
export const SETTINGS = TEXT.sales.settings;
const DEFAULT_PORT = 3100;
const PLAYWRIGHT_PORT = Number(process.env.PLAYWRIGHT_PORT ?? DEFAULT_PORT);
const CODE_SUFFIX_LENGTH = 6;
/** خادم الشراء المفتوح (العلم مفتوح، بلا مزوّد) من البناء نفسه وعلى القاعدة نفسها. */
export const CHECKOUT_ORIGIN = `http://127.0.0.1:${String(PLAYWRIGHT_PORT + 1)}`;

export interface SeededProduct {
  readonly id: string;
  readonly slug: string;
}

export interface CatalogSeed {
  readonly db: Db;
  readonly club: Club;
  readonly staff: TestStaff;
}

/** منتج عبر `createProduct` نفسها؛ يُنشر إن طُلب. */
export async function seedProduct(
  seed: CatalogSeed,
  input: Partial<ProductDraftInput> = {},
  publish = true,
): Promise<SeededProduct> {
  const { db, club, staff } = seed;
  const productId = randomUUID();
  const draft = productDraft({ slug: testSlug("ct-e2e"), ...input });
  const actor = staffActor(staff.id);
  const now = new Date();
  unwrap(await createProduct(db, { productId, clubId: club.id, draft, actor, now }));
  if (publish) {
    const detail = await getCatalogProduct(db, club.id, productId, new Date());
    unwrap(
      await setProductStatus(db, {
        productId,
        clubId: club.id,
        lockToken: detail?.lockToken ?? "",
        action: "publish",
        confirmLast: false,
        actor,
        now: new Date(),
      }),
    );
  }
  return { id: productId, slug: draft.slug };
}

export async function linkAddon(
  seed: CatalogSeed,
  addon: SeededProduct,
  plans: readonly SeededProduct[],
): Promise<void> {
  const detail = await getCatalogProduct(seed.db, seed.club.id, addon.id, new Date());
  unwrap(
    await setAddonLinks(seed.db, {
      productId: addon.id,
      clubId: seed.club.id,
      lockToken: detail?.lockToken ?? "",
      membershipIds: plans.map((plan) => plan.id),
      actor: staffActor(seed.staff.id),
      now: new Date(),
    }),
  );
}

export interface SeededPromotion {
  readonly id: string;
  readonly code: string | null;
}

let codeCounter = 0;

/** رمز كوبون فريد لكل اختبار (الرمز فريد لكل نادٍ، والأندية جديدة، لكن الفرادة تريح القراءة). */
export function uniqueCode(prefix = "E2E"): string {
  codeCounter += 1;
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, CODE_SUFFIX_LENGTH).toUpperCase()}${String(codeCounter)}`;
}

/** عرض عبر `createPromotion` نفسها؛ يُفعَّل إن طُلب. */
export async function seedPromotion(
  seed: CatalogSeed,
  input: Partial<PromotionDraftInput> = {},
  activate = true,
): Promise<SeededPromotion> {
  const { db, club, staff } = seed;
  const promotionId = randomUUID();
  const draft = promotionDraft({ code: uniqueCode(), ...input });
  const actor = staffActor(staff.id);
  unwrap(
    await createPromotion(db, { promotionId, clubId: club.id, draft, actor, now: new Date() }),
  );
  if (activate) {
    const detail = await getPromotionDetail(db, club.id, promotionId, new Date());
    unwrap(
      await setPromotionStatus(db, {
        promotionId,
        clubId: club.id,
        lockToken: detail?.lockToken ?? "",
        action: "activate",
        actor,
        now: new Date(),
      }),
    );
  }
  return { id: promotionId, code: draft.code };
}

export interface CouponOrder {
  readonly planSlug: string;
  readonly totalMinor: number;
  readonly code: string | null;
  readonly paid?: boolean;
}

/** طلب حقيقي بكوبون عبر `createOrder`، ويُدفع إن طُلب. */
export async function seedCouponOrder(db: Db, order: CouponOrder): Promise<string> {
  const coupon = order.code === null ? null : promotionDraft({ code: order.code }).code;
  const input = orderInput(order.planSlug, order.totalMinor, {
    couponCode: coupon,
    buyer: testBuyer(randomE164(), "عميل العرض"),
    now: new Date(),
  });
  const created = unwrap(await createOrder(db, input));
  if (order.paid === true) {
    const payment = {
      provider: "test_pay",
      providerPaymentId: `e2e-${created.orderId}`,
      amountMinor: order.totalMinor,
      currency: "SAR",
    };
    unwrap(
      await markOrderPaid(db, {
        orderId: created.orderId,
        payment,
        actor: "provider",
        now: new Date(),
      }),
    );
  }
  return created.orderId;
}

export function planUrl(product: SeededProduct, tab?: string): string {
  const base = `/admin/sales/plans/${product.id}`;
  return tab === undefined ? base : `${base}?tab=${tab}`;
}

export function promotionUrl(promotion: SeededPromotion): string {
  return `/admin/sales/promotions/${promotion.id}`;
}

export function planRows(page: Page): Locator {
  return page.getByTestId("plans-table").locator("tbody tr");
}

/** رابط المنتج في الجدول باسمه لقارئ الشاشة. */
export function planLink(page: Page, name: string): Locator {
  return page.getByRole("link", { name: PLANS.open.replace("{name}", name) });
}

export function promotionLink(page: Page, name: string): Locator {
  return page.getByRole("link", { name: PROMOTIONS.open.replace("{name}", name) });
}

/** تنبيه النجاح بعد إجراء (من `?done=`). */
export async function expectNotice(page: Page, text: string): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}

/** حقل نموذج بتسميته التامة (تسميات «بالعربية» و«بالإنجليزية» تتشابه في البداية). */
export function field(page: Page, label: string): Locator {
  return page.getByLabel(label, { exact: true });
}
