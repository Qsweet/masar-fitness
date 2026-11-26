import { DomainError, type FieldIssue } from "@masar/domain";

/**
 * حالة نماذج اللوحة ذات الحقول الكثيرة: ما كتبه الموظف يعود كما هو عند الرفض، ولكل حقل خطؤه بجانبه،
 * وخطوة مراجعة اختيارية يعيد فيها الخادم عرض ما سيُنفَّذ. بلا اعتماد على الخادم: يستوردها مكوّن
 * النموذج في المتصفح نوعًا وقيمةً ابتدائية.
 */
export type FormValues = Readonly<Record<string, string>>;

export interface FormFailure {
  /** سبب على مستوى النموذج (مفتاح في `errors`)، أو null. */
  readonly error: string | null;
  /** الحقل ← سببه. */
  readonly fields: Readonly<Record<string, string>>;
}

export interface FieldFormState extends FormFailure {
  readonly step: "edit" | "confirm";
  readonly values: FormValues;
  /** أسطر «التسمية: القيمة» التي يعيد الخادم عرضها في خطوة المراجعة. */
  readonly review: readonly (readonly [label: string, value: string])[];
  /** يتغير مع كل رد: الحقول تُرسم من جديد بقيم الرد لا بما بقي في المتصفح. */
  readonly stamp: number;
}

export const FORM_INTENTS = ["save", "confirm", "edit"] as const;
export type FormIntent = (typeof FORM_INTENTS)[number];

export function initialFieldForm(values: FormValues): FieldFormState {
  return { step: "edit", error: null, fields: {}, values, review: [], stamp: 0 };
}

/** خطأ عمل أو أخطاء حقول ← ما يعرضه النموذج. خطأ العمل بحقل يظهر بجانب حقله. */
export function failureOf(error: DomainError | readonly FieldIssue[]): FormFailure {
  if (error instanceof DomainError) {
    return error.field === undefined
      ? { error: error.reason, fields: {} }
      : { error: null, fields: { [error.field]: error.reason } };
  }
  return {
    error: null,
    fields: Object.fromEntries(error.map((issue) => [issue.field, issue.reason])),
  };
}

export function formFailure(reason: string): FormFailure {
  return { error: reason, fields: {} };
}

/** النموذج مرفوضًا: يعود إلى الحقول بما كُتب وبأخطائه. */
export function rejectedForm(values: FormValues, failure: FormFailure): FieldFormState {
  return { step: "edit", ...failure, values, review: [], stamp: Date.now() };
}

/** خطوة المراجعة: القيم كما كُتبت (تُعاد حقولًا مخفية) وما سيُنفَّذ نصًّا. */
export function reviewForm(values: FormValues, review: FieldFormState["review"]): FieldFormState {
  return { step: "confirm", error: null, fields: {}, values, review, stamp: Date.now() };
}

/** قيم الحقول المسمّاة بحدّ طول لكل حقل؛ الأطول يُعامل فارغًا (مرفوضًا) لا مقصوصًا. */
export function readFormValues(
  formData: FormData,
  limits: Readonly<Record<string, number>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(limits).map(([name, maxLength]) => {
      const value = formData.get(name);
      return [name, typeof value === "string" && value.length <= maxLength ? value : ""];
    }),
  );
}

export function formIntent(formData: FormData): FormIntent {
  const value = formData.get("intent");
  return FORM_INTENTS.find((intent) => intent === value) ?? "save";
}
