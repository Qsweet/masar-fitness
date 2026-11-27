import { err, ok, type Result } from "../../result";
import { CONTENT_LOCALES, type ContentLocale } from "../locale";
import {
  DESKTOP_IMAGE_MIN_WIDTH,
  MOBILE_IMAGE_MIN_WIDTH,
  SLIDE_ALT_LIMIT,
  SLIDE_TEXT_FIELDS,
  SLIDE_TEXT_LIMITS,
  type SlideTextField,
} from "./limits";
import { parseSlideLink, type SlideLinkInput } from "./link";
import { parseSchedule } from "./schedule";
import { normalizeSlideText } from "./text";
import { CLICK_TARGETS, type ClickTarget, type SlideContent, type SlideImage } from "./types";

/**
 * التحقق من شريحة قبل حفظها (ADMIN_A3_SLIDER §2): كل حقل بقاعدته، ثم القواعد المترابطة بين الرابط
 * والزر والنص البديل. كل أخطاء الحقول معًا لا أولها، ليظهر كلٌّ بجانب حقله.
 */
export interface SlideIssue {
  /** `desktop`، `alt.ar`، `texts.en.cta`، `link`، `endsAt`… */
  readonly field: string;
  readonly reason: string;
  readonly detail?: string;
}

export interface SlideInput {
  readonly desktop: SlideImage | null;
  readonly mobile: SlideImage | null;
  readonly decorative: boolean;
  readonly alt: Readonly<Record<ContentLocale, string>>;
  readonly texts: Readonly<Record<ContentLocale, Readonly<Record<SlideTextField, string>>>>;
  readonly link: SlideLinkInput;
  readonly clickTarget: string;
  readonly active: boolean;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface SlideContext {
  /** المسارات الداخلية المعروفة الآن (الصفحات والمراسي والباقات والمقالات). */
  readonly knownPaths: ReadonlySet<string>;
  readonly timeZone: string;
}

type Texts = Record<ContentLocale, Record<SlideTextField, string>>;

function imageIssues(input: SlideInput): SlideIssue[] {
  const issues: SlideIssue[] = [];
  if (input.desktop === null) {
    issues.push({ field: "desktop", reason: "slider.image_required" });
  } else if (input.desktop.width < DESKTOP_IMAGE_MIN_WIDTH) {
    const detail = String(DESKTOP_IMAGE_MIN_WIDTH);
    issues.push({ field: "desktop", reason: "slider.image_too_small", detail });
  }
  if (input.mobile !== null && input.mobile.width < MOBILE_IMAGE_MIN_WIDTH) {
    const detail = String(MOBILE_IMAGE_MIN_WIDTH);
    issues.push({ field: "mobile", reason: "slider.image_too_small", detail });
  }
  return issues;
}

function textIssues(input: SlideInput, texts: Texts, alt: Record<ContentLocale, string>) {
  const issues: SlideIssue[] = [];
  for (const locale of CONTENT_LOCALES) {
    for (const field of SLIDE_TEXT_FIELDS) {
      const value = normalizeSlideText(
        input.texts[locale][field],
        locale,
        SLIDE_TEXT_LIMITS[field],
      );
      if (value.ok) {
        texts[locale][field] = value.value;
      } else {
        issues.push({ field: `texts.${locale}.${field}`, ...value.error });
      }
    }
    const altText = normalizeSlideText(input.alt[locale], locale, SLIDE_ALT_LIMIT);
    if (!altText.ok) {
      issues.push({ field: `alt.${locale}`, ...altText.error });
    } else if (!input.decorative && altText.value === "") {
      issues.push({ field: `alt.${locale}`, reason: "slider.alt_required" });
    } else {
      alt[locale] = input.decorative ? "" : altText.value;
    }
  }
  return issues;
}

/**
 * القواعد المترابطة على شريحة طبيعية (حفظ أو لقطة): بلا رابط لا زر؛ النقر على الزر يشترط تسميته في كل
 * لغة؛ النقر على الشريحة يشترط اسمًا ظاهرًا للرابط في كل لغة (الزر أو العنوان أو النص البديل).
 */
export function slideRuleIssues(slide: SlideContent): SlideIssue[] {
  const issues: SlideIssue[] = [];
  for (const locale of CONTENT_LOCALES) {
    const texts = slide.texts[locale];
    if (slide.link.kind === "none") {
      if (texts.cta !== "") {
        issues.push({ field: `texts.${locale}.cta`, reason: "slider.cta_without_link" });
      }
    } else if (slide.clickTarget === "button" && texts.cta === "") {
      issues.push({ field: `texts.${locale}.cta`, reason: "slider.cta_required" });
    } else if (texts.cta === "" && texts.title === "" && slide.alt[locale] === "") {
      issues.push({ field: "link", reason: "slider.link_name_missing" });
    }
  }
  return issues.filter(
    (issue, index) => issues.findIndex((other) => other.field === issue.field) === index,
  );
}

/** بلا رابط لا معنى لهدف النقر (حقله مخفي في النموذج): «الزر» افتراضيًا. */
function clickTargetOf(raw: string, linkKind: string): ClickTarget | null {
  const known = CLICK_TARGETS.find((target) => target === raw);
  return known ?? (linkKind === "none" ? "button" : null);
}

function emptyTexts(): Texts {
  const blank = (): Record<SlideTextField, string> => ({
    eyebrow: "",
    title: "",
    subtitle: "",
    cta: "",
  });
  return { ar: blank(), en: blank() };
}

export function validateSlide(
  input: SlideInput,
  context: SlideContext,
): Result<SlideContent, readonly SlideIssue[]> {
  const texts = emptyTexts();
  const alt: Record<ContentLocale, string> = { ar: "", en: "" };
  const issues = [...imageIssues(input), ...textIssues(input, texts, alt)];
  const link = parseSlideLink(input.link, context.knownPaths);
  if (!link.ok) {
    issues.push({ field: "link", reason: link.error });
  }
  const clickTarget = clickTargetOf(input.clickTarget, input.link.kind);
  if (clickTarget === null) {
    issues.push({ field: "clickTarget", reason: "slider.click_target_unknown" });
  }
  const schedule = parseSchedule(input, context.timeZone);
  if (!schedule.ok) {
    issues.push(schedule.error);
  }
  if (!link.ok || clickTarget === null || !schedule.ok || input.desktop === null) {
    return err(issues);
  }
  const content: SlideContent = {
    desktop: input.desktop,
    mobile: input.mobile,
    decorative: input.decorative,
    alt,
    texts,
    link: link.value,
    // بلا رابط لا معنى لهدف النقر: يُحفظ «الزر» فلا يتغير الفرق بلا سبب
    clickTarget: link.value.kind === "none" ? "button" : clickTarget,
    active: input.active,
    ...schedule.value,
  };
  const all = [...issues, ...slideRuleIssues(content)];
  return all.length === 0 ? ok(content) : err(all);
}
