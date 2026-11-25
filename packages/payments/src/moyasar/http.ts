/**
 * استدعاء واجهة Moyasar بالمفتاح السري. `fetch` يُحقن، فلا شبكة في الاختبارات.
 * - العنوان `https://api.moyasar.com/v1`: docs.moyasar.com/docs/guides/invoices/creating-invoices.md
 * - المصادقة HTTP Basic: المفتاح اسم المستخدم وكلمة المرور فارغة، و HTTPS إلزامي:
 *   docs.moyasar.com/docs/getting-started/authentication.md
 * - جسم الخطأ `{type, message, errors}`: docs.moyasar.com/api/invoices/01-create-invoice
 * لا يُحفظ من رد الخطأ إلا `type` (رمز آلي)، ولا يُقرأ `message` أبدًا (نص حر).
 */
import { err, ok, type Result } from "@masar/domain";
import { ProviderError } from "../port";

export const MOYASAR_API_BASE_URL = "https://api.moyasar.com/v1";

export interface MoyasarHttpOptions {
  readonly secretKey: string;
  readonly fetch: typeof fetch;
  readonly timeoutMs: number;
}

export type MoyasarMethod = "GET" | "POST" | "PUT";

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR_MIN = 500;
/** رمز آلي قصير بأحرف صغيرة، مثل `authentication_error`. أي شكل آخر لا يُحفظ. */
const ERROR_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function basicAuthorization(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
}

function errorType(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("type" in body)) {
    return undefined;
  }
  const { type } = body;
  return typeof type === "string" && ERROR_TYPE_PATTERN.test(type) ? type : undefined;
}

function failure(status: number, body: unknown): ProviderError {
  const type = errorType(body);
  const details = { httpStatus: status, ...(type === undefined ? {} : { code: type }) };
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return new ProviderError("unauthorized", details);
  }
  if (status === HTTP_NOT_FOUND) {
    return new ProviderError("not_found", details);
  }
  // 5xx: النتيجة عند المزوّد مجهولة، كالانقطاع
  return new ProviderError(status >= HTTP_SERVER_ERROR_MIN ? "unreachable" : "rejected", details);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const parsed: unknown = await response.json();
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * طلب واحد بمهلة، بلا إعادة محاولة: إنشاء الفاتورة بلا مفتاح عدم تكرار موثق، فإعادته قد تنشئ
 * فاتورتين قابلتين للدفع. الانقطاع والمهلة و5xx ترجع `unreachable`.
 */
export async function moyasarRequest(
  options: MoyasarHttpOptions,
  method: MoyasarMethod,
  path: string,
  body?: Readonly<Record<string, unknown>>,
): Promise<Result<unknown, ProviderError>> {
  let response: Response;
  try {
    response = await options.fetch(`${MOYASAR_API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: basicAuthorization(options.secretKey),
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(options.timeoutMs),
      redirect: "error",
    });
  } catch {
    // لا يُحفظ الخطأ الأصلي: قد يحمل الرابط، والنوع يكفي
    return err(new ProviderError("unreachable", { code: "network_or_timeout" }));
  }
  const json = await readJson(response);
  if (response.status < HTTP_OK_MIN || response.status > HTTP_OK_MAX) {
    return err(failure(response.status, json));
  }
  if (json === undefined) {
    const details = { httpStatus: response.status, code: "body_not_json" };
    return err(new ProviderError("malformed_response", details));
  }
  return ok(json);
}
