/**
 * مساعدات إدراج لاختبارات قيود البيع: تكتب الصفوف مباشرة (SQL خام للطلبات) فتختبر القاعدة نفسها
 * دون الاعتماد على طبقة الطلبات. كل الأرقام هنا قيم اختبار لا قرارات المالك.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "../client";
import type { MembershipStartRule, Prisma, ProductKind } from "../generated/prisma/client";
import {
  TEST_CLUB_SLUG_PREFIX,
  TEST_PAYMENT_WINDOW_MINUTES,
  TEST_PERCENT_BPS,
  TEST_VALID_FROM,
  TEST_VAT_RATE_BPS,
  type TestProduct,
} from "./commerce-constants";

export * from "./commerce-constants";
export * from "./raw-order";

const SLUG_SUFFIX_LENGTH = 8;

export interface TestClubPolicy {
  vatRateBps: number;
  orderPaymentWindowMinutes: number | null;
  membershipStartRule: MembershipStartRule | null;
}

export interface ProductInput {
  priceMinor: number;
  durationMonths?: number | null;
  bonusMonths?: number;
  benefits?: string[];
}

function uniqueSuffix(): string {
  return randomUUID().replaceAll("-", "").slice(0, SLUG_SUFFIX_LENGTH);
}

/** نادي اختبار بسياسات محسومة افتراضيًا؛ يمرَّر null لاختبار السياسة غير المحسومة. */
export async function createTestClub(
  db: Db,
  policy: Partial<TestClubPolicy> = {},
): Promise<string> {
  const club = await db.club.create({
    data: {
      slug: `${TEST_CLUB_SLUG_PREFIX}${uniqueSuffix()}`,
      nameAr: "نادي اختبار البيع",
      nameEn: "Commerce test club",
      vatRateBps: TEST_VAT_RATE_BPS,
      orderPaymentWindowMinutes: TEST_PAYMENT_WINDOW_MINUTES,
      membershipStartRule: "on_payment",
      ...policy,
    },
  });
  return club.id;
}

async function createProduct(
  db: Db,
  clubId: string,
  kind: ProductKind,
  input: ProductInput,
): Promise<TestProduct> {
  const durationMonths = input.durationMonths ?? null;
  const bonusMonths = input.bonusMonths ?? 0;
  const benefits = input.benefits ?? ["ميزة"];
  const product = await db.product.create({
    data: {
      clubId,
      kind,
      slug: `ct-${kind.replaceAll("_", "-")}-${uniqueSuffix()}`,
      status: "active",
      nameAr: "منتج اختبار",
      nameEn: "Test product",
      summaryAr: "وصف",
      summaryEn: "Summary",
      versions: {
        create: {
          priceMinor: input.priceMinor,
          durationMonths,
          bonusMonths,
          validFrom: TEST_VALID_FROM,
          benefits: {
            create: benefits.map((label, sortOrder) => ({
              labelAr: label,
              labelEn: label,
              sortOrder,
            })),
          },
        },
      },
    },
    include: { versions: true },
  });
  const versionId = product.versions[0]?.id ?? "";
  return {
    productId: product.id,
    slug: product.slug,
    versionId,
    kind,
    priceMinor: input.priceMinor,
    durationMonths,
    bonusMonths,
  };
}

export function createPlan(
  db: Db,
  clubId: string,
  input: ProductInput & { durationMonths: number },
): Promise<TestProduct> {
  return createProduct(db, clubId, "membership", input);
}

/** إضافة مربوطة بالباقة في product_addons. */
export async function createAddon(
  db: Db,
  clubId: string,
  membershipProductId: string,
  input: ProductInput,
): Promise<TestProduct> {
  const addon = await createProduct(db, clubId, "addon", { ...input, durationMonths: null });
  await db.productAddon.create({
    data: { membershipProductId, addonProductId: addon.productId },
  });
  return addon;
}

export function createDigitalProgram(
  db: Db,
  clubId: string,
  input: ProductInput,
): Promise<TestProduct> {
  return createProduct(db, clubId, "digital_program", { ...input, durationMonths: null });
}

export function createAssessedService(
  db: Db,
  clubId: string,
  input: ProductInput,
): Promise<TestProduct> {
  return createProduct(db, clubId, "assessed_service", { ...input, durationMonths: null });
}

/** عرض فعّال لكل المنتجات ولأي عميل بخصم مئوي، ما لم يُغيَّر. */
export async function createPromotion(
  db: Db,
  clubId: string,
  overrides: Partial<Prisma.PromotionUncheckedCreateInput> = {},
): Promise<string> {
  const promotion = await db.promotion.create({
    data: {
      clubId,
      nameAr: "عرض اختبار",
      nameEn: "Test promotion",
      status: "active",
      discountKind: "percentage",
      percentBps: TEST_PERCENT_BPS,
      audience: "anyone",
      scope: "all_products",
      startsAt: TEST_VALID_FROM,
      ...overrides,
    },
  });
  return promotion.id;
}
