/** ثوابت اختبارات البيع وأنواعها المشتركة. كلها قيم اختبار، لا قرارات المالك. */
import type { ProductKind } from "../generated/prisma/client";

/** أندية الاختبار تُعرف ببادئتها، و`resetCommerceTables` يحذف كتالوجها وحدها. */
export const TEST_CLUB_SLUG_PREFIX = "commerce-test-";
/** نسبة ضريبة اختبار (15%) بنقاط الأساس. */
export const TEST_VAT_RATE_BPS = 1500;
/** مهلة اختبار للطلب غير المدفوع بالدقائق. */
export const TEST_PAYMENT_WINDOW_MINUTES = 30;
export const TEST_VALID_FROM = new Date("2026-01-01T00:00:00Z");
export const TEST_NOW = new Date("2026-06-15T09:00:00Z");
export const TEST_PHONE = "+966512345678";
export const TEST_PERCENT_BPS = 1000;

export interface TestProduct {
  productId: string;
  slug: string;
  versionId: string;
  kind: ProductKind;
  priceMinor: number;
  durationMonths: number | null;
  bonusMonths: number;
}
