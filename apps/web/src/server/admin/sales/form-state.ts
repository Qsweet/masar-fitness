/** حالات نماذج المبيعات. بلا اعتماد على الخادم: تستوردها مكوّنات المتصفح نوعًا وقيمةً ابتدائية. */

/** كشف الجوال: الرقم يرجع في حالة النموذج فقط (لا في رابط)، ويبقى حتى مغادرة الصفحة. */
export interface RevealState {
  readonly error: string | null;
  readonly phone: string | null;
}

export const HIDDEN_PHONE: RevealState = { error: null, phone: null };

/** ما كتبه الموظف في الخطوة الأولى، ليُعاد عرضه عند خطأ أو عند «عدّل البيانات». */
export interface SettleValues {
  readonly method: string;
  readonly externalReference: string;
  readonly receivedOn: string;
  readonly amount: string;
  readonly note: string;
}

/** ما يُعاد عرضه في الخطوة الثانية، بنصوصه الجاهزة من الخادم. */
export interface SettleSummary {
  readonly amount: string;
  readonly method: string;
  readonly externalReference: string;
  readonly receivedOn: string;
  readonly note: string | null;
}

/** خطأ النموذج: السبب، ومرجع الطلب الذي استعمل المرجع الخارجي من قبل حين يكون هذا هو السبب. */
export interface SettleError {
  readonly error: string | null;
  readonly usedByOrder?: string | null;
}

export type SettleFormState =
  | ({ readonly step: "edit"; readonly values: SettleValues } & SettleError)
  | ({
      readonly step: "confirm";
      readonly values: SettleValues;
      /** رمز مختوم بمفتاح اللوحة: ما يُنفَّذ في الخطوة الثانية هو ما فيه وحده. */
      readonly token: string;
      readonly summary: SettleSummary;
    } & SettleError);

export const SETTLE_INTENTS = ["review", "confirm", "edit"] as const;
export type SettleIntent = (typeof SETTLE_INTENTS)[number];

export function initialSettleState(values: SettleValues): SettleFormState {
  return { step: "edit", error: null, values };
}
