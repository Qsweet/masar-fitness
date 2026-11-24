/**
 * هل يُسمح لمحركات البحث بفهرسة هذا النشر؟
 * مغلق افتراضيًا: النطاق المؤقت لا يُفهرس، ولا يُفتح إلا بالقيمة "true" حرفيًا
 * عند نقل النطاق الرسمي بأمر المالك. أي قيمة أخرى (أو غيابها) = مغلق.
 */
export function isSiteIndexable(rawValue: string | undefined): boolean {
  return rawValue === "true";
}

export const NOINDEX_HEADER = { name: "X-Robots-Tag", value: "noindex, nofollow" } as const;
