/** حالة نماذج اللوحة وقراءة حقولها. بلا اعتماد على الخادم: يستوردها مكوّن النموذج في المتصفح نوعًا. */
export interface AdminFormState {
  /** مفتاح سبب ثابت يترجمه القاموس (`errors`)، أو null. */
  readonly error: string | null;
}

export const EMPTY_FORM_STATE: AdminFormState = { error: null };

export function failed(reason: string): AdminFormState {
  return { error: reason };
}

/** قيمة حقل نصي بحد أقصى للطول؛ الأطول يُعامل كفارغ (مرفوض) لا مقصوصًا. */
export function textField(formData: FormData, name: string, maxLength: number): string {
  const value = formData.get(name);
  return typeof value === "string" && value.length <= maxLength ? value : "";
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_LENGTH = 36;

/** معرّف من حقل مخفي؛ null إن لم يكن بشكل UUID (لا يصل نص عشوائي إلى استعلام). */
export function idField(formData: FormData, name: string): string | null {
  const value = textField(formData, name, UUID_LENGTH);
  return UUID_SHAPE.test(value) ? value : null;
}

export function isUuid(value: string): boolean {
  return UUID_SHAPE.test(value);
}

/**
 * قائمة معرّفات من خانات بالاسم نفسه، حتى `max`. null إن كان أحدها ليس بشكل UUID أو زادت عن الحد:
 * الطلب مصنوع لا من النموذج، فيُرفض كله ولا يُسقط منه شيء بصمت.
 */
export function idListField(formData: FormData, name: string, max: number): string[] | null {
  const values = formData.getAll(name);
  if (values.length > max) {
    return null;
  }
  const ids = values.filter((value): value is string => typeof value === "string" && isUuid(value));
  return ids.length === values.length ? ids : null;
}
