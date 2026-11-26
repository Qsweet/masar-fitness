/** قيود العروض التي هي سدود لسباقات معروفة ⇒ سبب خطأ العمل. P2 (هوية العرض) يبقى عطلًا يظهر. */
import { constraintName } from "../commerce/sql-errors";

export const PROMOTIONS_ADMIN_CONSTRAINTS = {
  codeUnique: "promotions_club_id_code_key",
  primaryKey: "promotions_pkey",
} as const;

/** هل الخطأ اصطدام إنشاء (المعرّف نفسه أو الرمز نفسه)؟ يُفحص بعده هل هو إعادة إرسال. */
export function isPromotionCreateCollision(error: unknown): boolean {
  const name = constraintName(error);
  return (
    name === PROMOTIONS_ADMIN_CONSTRAINTS.codeUnique ||
    name === PROMOTIONS_ADMIN_CONSTRAINTS.primaryKey
  );
}
