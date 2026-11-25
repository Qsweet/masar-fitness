/**
 * حدود التسعير. كلها حدود تقنية أو ثوابت تمثيل، لا قواعد عمل.
 */

/** حد int4 في PostgreSQL: أعمدة المال INTEGER بالهللة، فلا مبلغ يتجاوزه (حد تقني). */
export const MAX_AMOUNT_MINOR = 2_147_483_647;

/** أقصى عدد للإضافات في طلب واحد، ويطابقه حد نموذج الشراء. */
export const MAX_ADDONS_PER_ORDER = 5;

/** مقياس نقاط الأساس: 10000 نقطة = 100%. */
export const BASIS_POINTS_SCALE = 10_000;
