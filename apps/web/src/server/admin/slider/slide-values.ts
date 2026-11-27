import { CONTENT_LOCALES, formatZonedDateTime, SLIDE_TEXT_FIELDS, type Slide } from "@masar/domain";
import type { FormValues } from "../field-form";
import { altField, SLIDE_FIELDS, textFieldName } from "./slide-form-names";

/**
 * شريحة محفوظة ← قيم نموذجها (للتعديل)، والقيم الأولى لشريحة جديدة. بلا اعتماد على الخادم: يستوردها
 * مكوّن النموذج للمعاينة الحية أيضًا.
 */
const CHECKED = "on";

const flag = (on: boolean) => (on ? CHECKED : "");

function linkValues(link: Slide["link"]): FormValues {
  return {
    [SLIDE_FIELDS.linkKind]: link.kind,
    [SLIDE_FIELDS.linkInternal]: link.kind === "internal" ? link.path : "",
    [SLIDE_FIELDS.linkExternal]: link.kind === "external" ? link.url : "",
    [SLIDE_FIELDS.linkNewTab]: flag(link.kind === "external" && link.newTab),
  };
}

export function slideValues(slide: Slide, timeZone: string): FormValues {
  const texts = CONTENT_LOCALES.flatMap((locale): [string, string][] => [
    [altField(locale), slide.alt[locale]],
    ...SLIDE_TEXT_FIELDS.map((field): [string, string] => [
      textFieldName(locale, field),
      slide.texts[locale][field],
    ]),
  ]);
  const time = (at: Date | null) => (at === null ? "" : formatZonedDateTime(at, timeZone));
  return {
    ...Object.fromEntries(texts),
    ...linkValues(slide.link),
    [SLIDE_FIELDS.desktop]: slide.desktop.id,
    [SLIDE_FIELDS.mobile]: slide.mobile?.id ?? "",
    [SLIDE_FIELDS.decorative]: flag(slide.decorative),
    [SLIDE_FIELDS.clickTarget]: slide.clickTarget,
    [SLIDE_FIELDS.active]: flag(slide.active),
    [SLIDE_FIELDS.startsAt]: time(slide.startsAt),
    [SLIDE_FIELDS.endsAt]: time(slide.endsAt),
  };
}

export const NEW_SLIDE_VALUES: FormValues = {
  [SLIDE_FIELDS.linkKind]: "none",
  [SLIDE_FIELDS.clickTarget]: "button",
  [SLIDE_FIELDS.active]: CHECKED,
};
