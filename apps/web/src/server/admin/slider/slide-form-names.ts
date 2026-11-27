import type { ContentLocale, SlideTextField } from "@masar/domain";

/** أسماء حقول نموذج الشريحة: يكتبها المكوّن ويقرؤها الخادم ويعيد إليها الأخطاء. */
export const SLIDE_FIELDS = {
  id: "id",
  lockToken: "lockToken",
  desktop: "desktop",
  mobile: "mobile",
  decorative: "decorative",
  linkKind: "linkKind",
  linkInternal: "linkInternal",
  linkExternal: "linkExternal",
  linkNewTab: "linkNewTab",
  clickTarget: "clickTarget",
  active: "active",
  startsAt: "startsAt",
  endsAt: "endsAt",
} as const;

export function altField(locale: ContentLocale): string {
  return `alt.${locale}`;
}

export function textFieldName(locale: ContentLocale, field: SlideTextField): string {
  return `texts.${locale}.${field}`;
}
