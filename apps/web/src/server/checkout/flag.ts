import "server-only";
import { notFound } from "next/navigation";
import { getEnv } from "../env";

/** هل الشراء الإلكتروني مفتوح في هذا النشر؟ مغلق افتراضيًا ومرفوض في الإنتاج العام (parse-env). */
export function isCheckoutEnabled(): boolean {
  return getEnv().CHECKOUT_ENABLED;
}

/**
 * حارس كل صفحة شراء وكل Server Action للشراء: أول سطر فيها.
 * والعلم مغلق يرجع 404 قبل أي قراءة أو كتابة، فلا يُعرف حتى أن المسار موجود.
 */
export function requireCheckout(): void {
  if (!isCheckoutEnabled()) {
    notFound();
  }
}
