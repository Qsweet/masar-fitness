import type { SendOutcome, ServerProvider } from "@masar/domain";
import type { TransportResult } from "../transport";
import type { Built, PurchaseInput, TestInput } from "./common";
import { buildGa4Purchase, buildGa4Test, ga4ValidationError } from "./ga4";
import { buildMetaPurchase, buildMetaTest } from "./meta";
import { buildOpenaiPurchase, buildOpenaiTest } from "./openai";
import { buildSnapPurchase, buildSnapTest, snapStatusError } from "./snap";
import { buildTiktokPurchase, buildTiktokTest, tiktokCodeError } from "./tiktok";

export type { Built, PurchaseInput, TestInput } from "./common";

const PURCHASE: Readonly<Record<ServerProvider, (input: PurchaseInput) => Built>> = {
  ga4: buildGa4Purchase,
  meta: buildMetaPurchase,
  snap: buildSnapPurchase,
  tiktok: buildTiktokPurchase,
  openai: buildOpenaiPurchase,
};

const TEST: Readonly<Record<ServerProvider, (input: TestInput) => Built>> = {
  ga4: buildGa4Test,
  meta: buildMetaTest,
  snap: buildSnapTest,
  tiktok: buildTiktokTest,
  openai: buildOpenaiTest,
};

export function buildPurchase(provider: ServerProvider, input: PurchaseInput): Built {
  return PURCHASE[provider](input);
}

export function buildTest(provider: ServerProvider, input: TestInput): Built {
  return TEST[provider](input);
}

/**
 * خطأ مكتوب في جسم رد ناجح الرمز: تيك توك بـ`code`، وسناب بـ`status`، وتحقق GA4 برسائله. ميتا
 * وOpenAI بالرمز وحده (وثائق OpenAI لا تصف جسم الرد: «If one event in the batch fails, the full batch
 * fails»، فالرفض رمز HTTP).
 */
function bodyError(provider: ServerProvider, body: string): string | null {
  switch (provider) {
    case "ga4":
      return ga4ValidationError(body);
    case "snap":
      return snapStatusError(body);
    case "tiktok":
      return tiktokCodeError(body);
    case "meta":
    case "openai":
      return null;
  }
}

/** رد الناقل إلى نتيجة يقرر بها المجال (`decideDelivery`). الجسم لا يخرج من هنا. */
export function interpret(provider: ServerProvider, result: TransportResult): SendOutcome {
  if (result.kind === "network") {
    return result;
  }
  const apiError = bodyError(provider, result.body);
  // تيك توك: الحد (40100، وثيقة حدود المعدل الرسمية) وأعطال النظام مؤقتة، ولم نجد قائمة رموز رسمية
  // مقروءة تفصل الدائم عن المؤقت؛ فكل رمز غير الصفر يُعاد حتى أقصى المحاولات ثم يموت (القرار 89-7)
  return { kind: "response", status: result.status, apiError, apiRetryable: provider === "tiktok" };
}
