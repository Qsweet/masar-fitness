import { openSecret, sealSecret } from "@masar/db";
import {
  MANUAL_PAYMENT_METHODS,
  formatPlainDate,
  parsePlainDate,
  type ManualPaymentDetails,
} from "@masar/domain";
import { z } from "zod";
import { SETTLE_TOKEN_MINUTES } from "@/config/admin";

/**
 * رمز تأكيد الدفع اليدوي (ADMIN_A2_SALES §6.5): ما راجعه الموظف في الخطوة الثانية مختومًا
 * AES-256-GCM بمفتاح اللوحة، ومربوطًا بالموظف والطلب. الخادم ينفّذ ما في الرمز وحده، فلا تُغيَّر
 * القيم بين المراجعة والتنفيذ، ولا يُستعمل رمز موظف لغيره ولا رمز طلب على آخر. عمره عشر دقائق يفحصها
 * الخادم. معرّف الدفعة داخله: الإرسال الثاني للرمز نفسه إعادة بلا أثر.
 */
const MINUTE_MS = 60_000;
const TOKEN_MAX_AGE_MS = SETTLE_TOKEN_MINUTES * MINUTE_MS;
/** أقصى طول يُقبل للرمز قبل أي فك (ملاحظة من 500 محرف مشفّرة ومرمَّزة). */
export const MAX_SETTLE_TOKEN_LENGTH = 6_000;

const payloadSchema = z.object({
  paymentId: z.uuid(),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  externalReference: z.string(),
  receivedOn: z.string(),
  note: z.string().nullable(),
  amountMinor: z.number().int().positive(),
  currency: z.string(),
  issuedAt: z.number().int(),
});

export interface SettleTokenPayload {
  readonly paymentId: string;
  readonly details: ManualPaymentDetails;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface SettleTokenBinding {
  readonly key: Uint8Array;
  readonly staffId: string;
  readonly orderId: string;
}

function contextOf(binding: SettleTokenBinding): string {
  return `settle:${binding.staffId}:${binding.orderId}`;
}

export function sealSettleToken(
  binding: SettleTokenBinding,
  payload: SettleTokenPayload,
  now: Date,
): string {
  const { details } = payload;
  const sealed: z.infer<typeof payloadSchema> = {
    paymentId: payload.paymentId,
    method: details.method,
    externalReference: details.externalReference,
    receivedOn: formatPlainDate(details.receivedOn),
    note: details.note,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    issuedAt: now.getTime(),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(sealed));
  return sealSecret(binding.key, bytes, contextOf(binding));
}

/** هل ما زال الرمز ضمن مهلته؟ وقت من المستقبل مرفوض أيضًا. */
function isFresh(issuedAt: number, nowMs: number): boolean {
  return issuedAt <= nowMs && nowMs - issuedAt < TOKEN_MAX_AGE_MS;
}

/** ما في الرمز، أو null (معبوث به، أو لموظف أو طلب آخر، أو مضت مهلته، أو بغير شكله). */
export function openSettleToken(
  binding: SettleTokenBinding,
  token: string,
  now: Date,
): SettleTokenPayload | null {
  if (token === "" || token.length > MAX_SETTLE_TOKEN_LENGTH) {
    return null;
  }
  const opened = openSecret(binding.key, token, contextOf(binding));
  if (opened === null) {
    return null;
  }
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)));
    const receivedOn = parsed.success ? parsePlainDate(parsed.data.receivedOn) : null;
    if (
      !parsed.success ||
      receivedOn?.ok !== true ||
      !isFresh(parsed.data.issuedAt, now.getTime())
    ) {
      return null;
    }
    const { paymentId, method, externalReference, note, amountMinor, currency } = parsed.data;
    return {
      paymentId,
      details: { method, externalReference, receivedOn: receivedOn.value, note },
      amountMinor,
      currency,
    };
  } catch {
    return null;
  }
}
