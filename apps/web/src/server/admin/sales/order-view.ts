import type { OrderDetail } from "@masar/db";
import { lookup, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";

/**
 * ما يُعرض من حقائق الطلب بنصوص القاموس: اسم طريقة الدفع (لا معرّف مزوّد خامًا في الواجهة أبدًا)،
 * وتنبيه النجاح الذي يصدّقه حال الطلب. منطق صرف يُختبر بلا قاعدة ولا متصفح.
 */
type Payment = AdminDictionary["sales"]["statuses"]["payment"];
type Statuses = AdminDictionary["sales"]["statuses"];

const MANUAL = "manual";

/** اسم المزوّد؛ المجهول باسمه العام لا برمزه. */
export function providerLabel(provider: string, payment: Payment): string {
  return lookup(payment.providers, provider, payment.unknownProvider);
}

/** وسيلة الدفع عند المزوّد (بطاقة، مدى…)، أو null حين لم تُعرف بعد. */
export function attemptMethodLabel(method: string | null, payment: Payment): string | null {
  return method === null ? null : lookup(payment.methods, method, payment.unknownMethod);
}

/**
 * طريقة دفع الطلب في القوائم والتفصيل: «يدوي: حوالة بنكية» للدفعة اليدوية بطريقتها، واسم المزوّد
 * لغيرها، و«لم يُدفع» لما لا دفع عليه.
 */
export function paymentLabel(
  provider: string | null,
  manualMethod: string | null,
  statuses: Statuses,
): string {
  const { payment } = statuses;
  if (provider === null) {
    return payment.unpaid;
  }
  if (provider !== MANUAL || manualMethod === null) {
    return providerLabel(provider, payment);
  }
  const method = lookup(statuses.manualMethod, manualMethod, "");
  return method === "" ? payment.providers.manual : fill(payment.manualWith, { method });
}

type NoticeFacts = Pick<OrderDetail, "payment"> & {
  readonly order: Pick<OrderDetail["order"], "status">;
};

/** متى يصدق كل تنبيه: الرابط يُكتب باليد، وحال الطلب لا. */
const NOTICE_HOLDS: Readonly<Record<string, (detail: NoticeFacts) => boolean>> = {
  manual_payment_recorded: (detail) => detail.payment?.provider === MANUAL,
  order_cancelled: (detail) => detail.order.status === "cancelled",
};

/**
 * رمز تنبيه النجاح من ‎`?done=`‎ حين يطابق حال الطلب الفعلي فقط: «سُجّل الدفع» لا يظهر على طلب لم
 * يُدفع يدويًا، و«أُلغي الطلب» لا يظهر على طلب قائم. ما عدا ذلك لا تنبيه.
 */
export function orderNoticeCode(
  done: string | string[] | undefined,
  detail: NoticeFacts,
): string | undefined {
  if (typeof done !== "string" || !Object.hasOwn(NOTICE_HOLDS, done)) {
    return undefined;
  }
  return NOTICE_HOLDS[done]?.(detail) === true ? done : undefined;
}
