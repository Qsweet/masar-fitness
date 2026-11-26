import "server-only";
import { notFound } from "next/navigation";
import { getEnv } from "../env";

/** هل لوحة التحكم مفتوحة في هذا النشر؟ مغلقة ما لم يُضبط `ADMIN_SECRET_KEY` (docs/ADMIN_DESIGN.md §4.1). */
export function isAdminEnabled(): boolean {
  return getEnv().ADMIN_SECRET_KEY !== null;
}

/**
 * يُغلق المسار بـ404 واللوحة غير مضبوطة، قبل أي قراءة أو كتابة. الوسيط يسبقه إلى ذلك لكل طلب
 * (`proxy.ts`)؛ هذا السدّ الثاني داخل الصفحات والإجراءات نفسها.
 */
export function requireAdminOpen(): void {
  if (!isAdminEnabled()) {
    notFound();
  }
}

/** مفتاح تشفير أسرار اللوحة. يُستدعى بعد `requireAdminOpen` فقط. */
export function adminSecretKey(): Uint8Array {
  const key = getEnv().ADMIN_SECRET_KEY;
  if (key === null) {
    notFound();
  }
  return key;
}
