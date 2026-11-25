import { serializeJsonLd, type JsonObject } from "@/server/json-ld";
import { requestNonce } from "@/server/nonce";

/**
 * بيانات منظَّمة في HTML الخادم (الزواحف لا تشغّل JavaScript). وسم script عادي لا next/script
 * لأنه بيانات لا كود، ويحمل nonce الطلب كبقية السكربتات تحت سياسة أمان المحتوى.
 */
export async function JsonLd({ data }: { readonly data: JsonObject }) {
  const nonce = await requestNonce();
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // آمن: serializeJsonLd يرمّز < و> و& فلا يخرج نص المحتوى من الوسم
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
