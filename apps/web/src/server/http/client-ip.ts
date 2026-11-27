import "server-only";

/** المفتاح حين لا يصل عنوان: كل الطلبات بلا عنوان تشترك في حدّ واحد، وهذا الاتجاه الآمن. */
export const UNKNOWN_CLIENT_IP = "unknown";
/** أطول عنوان IPv6 نصيًا 45 محرفًا؛ أطول من ذلك ليس عنوانًا. */
const MAX_IP_LENGTH = 45;
const IP_SHAPE = /^[0-9A-Fa-f:.]+$/;

/**
 * عنوان العميل من `X-Forwarded-For`: الموقع لا يُكشف إلا خلف Caddy (deploy/compose.yml)، وCaddy
 * يكتب عنوان من اتصل به، وNext يملؤه بعنوان المقبس إن غاب. القيمة الأخيرة هي ما رآه أقرب وسيط،
 * فلا يستطيع العميل أن يختار مفتاحه بترويسة يرسلها. لا يُسجَّل، ويُستعمل مفتاح حدّ في الذاكرة؛ ويُحفظ
 * مع الطلب في `order_tracking` فقط إن وافق الزائر على الإعلانات (ADMIN_A5_TRACKING §5.2).
 */
export function clientIp(forwardedFor: string | null): string {
  const last = forwardedFor?.split(",").pop()?.trim() ?? "";
  if (last === "" || last.length > MAX_IP_LENGTH || !IP_SHAPE.test(last)) {
    return UNKNOWN_CLIENT_IP;
  }
  return last.toLowerCase();
}
