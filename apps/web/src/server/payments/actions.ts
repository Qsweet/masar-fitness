"use server";

import { FAKE_PROVIDER_ID, startPayment, type FakePaymentInput } from "@masar/payments";
import { notFound, redirect } from "next/navigation";
import {
  DEMO_MISMATCH_MINOR,
  PAY_NOTICE_PARAM,
  orderPath,
  orderReturnPath,
  type PayNotice,
} from "@/config/payments";
import { defaultDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { isLocale, localizedPath, type Locale } from "@/i18n/locales";
import { guardCheckout } from "../checkout/failure";
import { requireCheckout } from "../checkout/flag";
import { getOrderView, isPublicToken } from "../checkout/order-view";
import { requestIp } from "../checkout/throttle";
import { getEnv } from "../env";
import { getPayments } from "./runtime";
import { requireDemoPayments } from "./demo-guard";
import { allowPaymentStart, allowPaymentStartGlobally } from "./throttle";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formLocale(formData: FormData): Locale {
  const locale = field(formData, "locale");
  return isLocale(locale) ? locale : notFound();
}

function noticePath(locale: Locale, token: string, notice: PayNotice): string {
  return `${localizedPath(locale, orderPath(token))}?${PAY_NOTICE_PARAM}=${notice}`;
}

/**
 * زر «ادفع الآن» في صفحة الطلب. الترتيب ثابت: العلم أولًا (404 بلا أي قراءة)، ثم المزوّد المضبوط،
 * ثم حد العنوان، ثم الطلب برمزه، ثم بدء المحاولة والتوجيه إلى صفحة المزوّد المستضافة.
 * لا مبلغ ولا مرجع من النموذج: كلاهما من الطلب المحفوظ. والتفعيل لا يحدث هنا ولا عند العودة: بعد
 * قراءة الدفعة من المزوّد فقط.
 */
export async function payOrder(formData: FormData): Promise<void> {
  requireCheckout();
  const payments = getPayments();
  if (payments === null) {
    notFound();
  }
  const locale = formLocale(formData);
  const token = field(formData, "token");
  if (!isPublicToken(token)) {
    notFound();
  }
  const real = payments.deps.provider.id !== FAKE_PROVIDER_ID;
  if (!allowPaymentStart(await requestIp()) || (real && !allowPaymentStartGlobally())) {
    redirect(noticePath(locale, token, "throttled"));
  }
  const order = await getOrderView(token);
  if (order === undefined) {
    notFound();
  }
  const returnUrl = `${getEnv().SITE_URL}${localizedPath(locale, orderReturnPath(token))}`;
  const template = defaultDictionary(order.locale).onlinePayment.providerDescription;
  const started = await guardCheckout("payment.start_failed", () =>
    startPayment(payments.deps, {
      orderId: order.id,
      describe: (reference) => fill(template, { reference }),
      successUrl: returnUrl,
      backUrl: returnUrl,
    }),
  );
  if (!started.ok) {
    // الطلب لم يعد قابلًا للدفع، أو لم يبقَ وقت، أو محاولة جارية: صفحة الطلب تعرض حالته الفعلية
    const unavailable = started.error.reason === "payment.provider_unavailable";
    redirect(
      unavailable ? noticePath(locale, token, "failed") : localizedPath(locale, orderPath(token)),
    );
  }
  if (started.value.kind === "redirect") {
    redirect(started.value.url);
  }
  redirect(localizedPath(locale, orderReturnPath(token)));
}

const DEMO_OUTCOMES = ["paid", "failed", "mismatch", "pending"] as const;
type DemoOutcome = (typeof DEMO_OUTCOMES)[number];

function demoPayment(outcome: DemoOutcome, amountMinor: number): FakePaymentInput {
  const payments: Record<DemoOutcome, FakePaymentInput> = {
    paid: { state: "paid" },
    failed: { state: "failed" },
    mismatch: { state: "paid", amountMinor: amountMinor - DEMO_MISMATCH_MINOR },
    pending: { state: "in_progress" },
  };
  return payments[outcome];
}

/**
 * أزرار صفحة الدفع التجريبية (مزوّد الاختبار وعلى عنوان الجهاز نفسه فقط، وإلا 404): تسجّل نتيجة المحاكاة في ذاكرة المزوّد
 * ثم تعيد العميل إلى رابط العودة كما يفعل المزوّد الحقيقي. لا تمسّ الطلب: حالته تتغير بالتحقق وحده.
 */
export async function completeDemoPayment(formData: FormData): Promise<void> {
  requireCheckout();
  const { store } = await requireDemoPayments();
  const session = store.get(field(formData, "session"));
  const outcome = DEMO_OUTCOMES.find((known) => known === field(formData, "outcome"));
  if (session === undefined || outcome === undefined) {
    notFound();
  }
  // الحد نفسه لزر الدفع: تجاوزه يعيد العميل بلا تسجيل دفعة
  if (allowPaymentStart(await requestIp())) {
    const payment = demoPayment(outcome, session.request.amountMinor);
    store.addPayment(session.sessionId, payment);
  }
  redirect(session.request.successUrl);
}
