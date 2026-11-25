import type { OrderView } from "@masar/db";
import type { PaymentDisplayState } from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import { orderReturnPath, type PayNotice } from "@/config/payments";
import { getDictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localizedPath, type Locale } from "@/i18n/locales";
import type { ReviewView } from "./review-view";

/** الحالات التي يعرض لها قسم الدفع شيئًا غير «الخطوة التالية» القائمة. */
export type PanelState = Extract<PaymentDisplayState, "pay" | "resume" | "verifying" | "review">;

const PANEL_STATES: readonly PaymentDisplayState[] = ["pay", "resume", "verifying", "review"];

export interface PaymentPanelInput {
  readonly state: PaymentDisplayState;
  readonly retrying: boolean;
  readonly demo: boolean;
  readonly notice: PayNotice | null;
}

export interface PaymentPanelView {
  readonly state: PanelState;
  readonly title: string;
  readonly lead: string;
  /** زر يبدأ الدفع أو يكمله (POST)، أو null حين لا دفع ممكن من عندنا. */
  readonly payLabel: string | null;
  /** رابط صفحة العودة التي تتحقق من الدفع ثم تعرض الحالة. */
  readonly refresh: { readonly href: string; readonly label: string } | null;
  readonly whatsapp: { readonly href: string; readonly label: string } | null;
  /** تنبيه بعد محاولة بدء لم تنجح، أو أن المحاولة السابقة لم تكتمل. */
  readonly notice: string | null;
  readonly demoNotice: string | null;
  readonly token: string;
  readonly locale: Locale;
}

function isPanelState(state: PaymentDisplayState): state is PanelState {
  return PANEL_STATES.includes(state);
}

interface StateTexts {
  readonly lead: string;
  readonly payLabel: string | null;
  readonly refreshable: boolean;
  readonly whatsapp: boolean;
}

function stateTexts(state: PanelState, locale: Locale): StateTexts {
  const { panel } = getDictionary(locale).onlinePayment;
  const texts: Record<PanelState, StateTexts> = {
    pay: { lead: panel.payLead, payLabel: panel.pay, refreshable: false, whatsapp: false },
    resume: { lead: panel.resumeLead, payLabel: panel.resume, refreshable: true, whatsapp: false },
    verifying: { lead: panel.verifyingLead, payLabel: null, refreshable: true, whatsapp: false },
    review: { lead: panel.reviewLead, payLabel: null, refreshable: false, whatsapp: true },
  };
  return texts[state];
}

function noticeText(input: PaymentPanelInput, state: PanelState, locale: Locale): string | null {
  const { panel } = getDictionary(locale).onlinePayment;
  if (state !== "pay") {
    return null;
  }
  if (input.notice !== null) {
    return panel.notices[input.notice];
  }
  return input.retrying ? panel.retryNotice : null;
}

/**
 * قسم الدفع في صفحة الطلب، أو null للحالات التي تبقى فيها «الخطوة التالية» كما هي (مدفوع، منتهٍ،
 * مغلق، أو دفع لا يمكن بدؤه الآن). كل نص من القاموس، ولا وعد عن استرداد.
 */
export function toPaymentPanelView(
  order: OrderView,
  input: PaymentPanelInput,
  locale: Locale,
  token: string,
): PaymentPanelView | null {
  const { state } = input;
  if (!isPanelState(state)) {
    return null;
  }
  const { panel } = getDictionary(locale).onlinePayment;
  const texts = stateTexts(state, locale);
  const refreshHref = localizedPath(locale, orderReturnPath(token));
  const whatsappHref = whatsappUrl(fill(panel.whatsappMessage, { reference: order.reference }));
  return {
    state,
    title: panel.title,
    lead: texts.lead,
    payLabel: texts.payLabel,
    refresh: texts.refreshable ? { href: refreshHref, label: panel.refresh } : null,
    whatsapp: texts.whatsapp ? { href: whatsappHref, label: panel.whatsapp } : null,
    notice: noticeText(input, state, locale),
    demoNotice: input.demo ? panel.demoNotice : null,
    token,
    locale,
  };
}

/**
 * عنوان الصفحة وحالتها حين يكون للدفع كلمة: الطلب المعلّق الفائتة مهلته وله محاولة حيّة «نتحقق من
 * دفعتك» لا «انتهت المهلة»، والحادثة المفتوحة «قيد المراجعة». غير ذلك تبقى نصوص المراجعة كما هي.
 */
export function withPaymentHeadline(
  review: ReviewView,
  state: PaymentDisplayState,
  locale: Locale,
): ReviewView {
  const { headline, statuses } = getDictionary(locale).onlinePayment;
  if (state === "pay" || state === "resume") {
    return { ...review, lead: headline.payLead };
  }
  if (state === "verifying") {
    return {
      ...review,
      title: headline.verifyingTitle,
      lead: headline.verifyingLead,
      statusText: statuses.verifying,
      deadline: undefined,
    };
  }
  if (state === "review") {
    return {
      ...review,
      title: headline.reviewTitle,
      lead: headline.reviewLead,
      statusText: statuses.review,
      deadline: undefined,
    };
  }
  return review;
}
