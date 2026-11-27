import { lookup, type AdminDictionary } from "@/i18n/admin";
import { Alert } from "./kit";

/**
 * سبب رفض من `?error=` في الرابط، بعد تحويل من Route Handler أو إجراء بلا حالة (الرفع، الترتيب). سبب
 * مجهول لا يُعرض: الرابط لا يحمل نصًا يُطبع كما هو.
 */
export function QueryError({
  error,
  dictionary,
}: {
  readonly error: string | string[] | undefined;
  readonly dictionary: AdminDictionary;
}) {
  const text = typeof error === "string" ? lookup(dictionary.errors, error, "") : "";
  return text === "" ? null : <Alert tone="danger">{text}</Alert>;
}
