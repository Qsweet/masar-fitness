/**
 * ثوابت تقنية للسلة: اسم الكوكي ومدته وحد الإجراءات. لا سياسات عمل (القرار 58).
 */

/** كوكي httpOnly يحمل slug الاشتراك فقط، بلا سعر ولا كمية ولا بيانات شخصية. */
export const CART_COOKIE = "masar_cart";

const SECONDS_PER_DAY = 86_400;
/** مدة بقاء السلة في المتصفح بالأيام. */
const CART_MAX_AGE_DAYS = 30;
export const CART_COOKIE_MAX_AGE_SECONDS = CART_MAX_AGE_DAYS * SECONDS_PER_DAY;

/** أقصى إجراءات سلة (إضافة وحذف) من عنوان واحد في نافذة الشراء؛ يوقف السكربت لا العميل. */
export const MAX_CART_ACTIONS_PER_IP = 120;
