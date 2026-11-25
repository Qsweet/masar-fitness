/** يحوّل نصوص القاموس الحرفية إلى string ليكون القاموس العربي شكلًا تتبعه كل لغة أخرى. */
export type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends readonly (infer Item)[]
      ? readonly Widen<Item>[]
      : { readonly [K in keyof T]: Widen<T[K]> };
