/** صيغ كلمة معدودة: الواحد والاثنان بلا رقم («دقيقة»، «مرتين»)، ثم 3–10، ثم 11 فأكثر. */
export interface CountForms {
  readonly one: string;
  readonly two: string;
  readonly few: string;
  readonly many: string;
}

const DUAL = 2;
const FEW_MAX = 10;

/**
 * العدد مع معدوده بصيغته من القاموس. اختيار الصيغة هنا والكلمات في القاموس، فالإنجليزية
 * تكتب صيغتي الواحد والاثنين كاملتين («once»، «2 min») والعربية بلا رقم كعادتها.
 */
export function countText(count: number, forms: CountForms): string {
  if (count === 1) {
    return forms.one;
  }
  if (count === DUAL) {
    return forms.two;
  }
  return `${String(count)} ${count <= FEW_MAX ? forms.few : forms.many}`;
}
