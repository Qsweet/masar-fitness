/**
 * توثيق إشعار Moyasar واستخراج معرّفاته. لا توقيع على الجسم: الجسم يحمل `secret_token` الذي وضعه
 * التاجر، فيُقارن بزمن ثابت، **ثم تُقرأ الدفعة من واجهة Moyasar دائمًا قبل أي تفعيل** (المستدعي).
 * - كائن الإشعار `{id, type, created_at, secret_token, account_name, live, data}` وأحداثه:
 *   docs.moyasar.com/docs/api/other/webhooks/webhook-reference.md
 * - حدث `webhook_verification` (بلا `live`، والرمز في `data.verification_code`):
 *   docs.moyasar.com/docs/api/other/webhooks/verify-webhook.md
 * لا يخرج من هنا إلا نوع الحدث ومعرّفه ومعرّفا الدفعة والفاتورة. `data` يحمل اسم حامل البطاقة ورقمها
 * المقنَّع، فلا يُحفظ ولا يُسجَّل، ورمز التحقق لا يُقرأ هنا.
 */
import { err, ok, type ProviderMode, type Result } from "@masar/domain";
import type { NotificationRejection, ProviderNotification } from "../port";
import { secretsEqual } from "../secret";
import { isMoyasarId } from "./parse";

export interface MoyasarWebhookOptions {
  readonly webhookSecret: string;
  readonly mode: ProviderMode;
}

type Json = Readonly<Record<string, unknown>>;

const VERIFICATION_EVENT = "webhook_verification";
const PAYMENT_EVENT_PREFIX = "payment_";
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(rawBody: string): Json | undefined {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return isJson(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function paymentUpdate(
  body: Json,
  eventId: string | null,
  eventType: string,
  mode: ProviderMode,
): Result<ProviderNotification, NotificationRejection> {
  // `live`: «True if the payment is in live mode or false if it is in test mode»
  if (body.live !== (mode === "live")) {
    return err("mode_mismatch");
  }
  const data = isJson(body.data) ? body.data : undefined;
  if (data === undefined || !isMoyasarId(data.id)) {
    return err("malformed");
  }
  const invoiceId = data.invoice_id;
  return ok({
    kind: "payment_update",
    eventId,
    eventType,
    paymentId: data.id,
    sessionId: isMoyasarId(invoiceId) ? invoiceId : null,
  });
}

export function parseMoyasarNotification(
  rawBody: string,
  options: MoyasarWebhookOptions,
): Result<ProviderNotification, NotificationRejection> {
  const body = parseBody(rawBody);
  if (body === undefined) {
    return err("malformed");
  }
  const token = body.secret_token;
  if (typeof token !== "string" || !secretsEqual(token, options.webhookSecret)) {
    return err("unauthenticated");
  }
  const { type } = body;
  if (typeof type !== "string" || !EVENT_TYPE_PATTERN.test(type)) {
    return err("malformed");
  }
  const eventId = typeof body.id === "string" && isMoyasarId(body.id) ? body.id : null;
  if (type === VERIFICATION_EVENT) {
    return ok({ kind: "endpoint_verification", eventId });
  }
  if (type.startsWith(PAYMENT_EVENT_PREFIX)) {
    return paymentUpdate(body, eventId, type, options.mode);
  }
  return ok({ kind: "unrelated", eventId, eventType: type });
}
