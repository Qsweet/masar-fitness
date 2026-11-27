import type { DraftRow } from "@masar/db";
import {
  CONTENT_LOCALES,
  textKey,
  type ContentLocale,
  type TextEntry,
  type TextOverride,
} from "@masar/domain";
import type { ContentState } from "./state";

/**
 * حالة كل نص ولغة في صفحة المساحة (ADMIN_A3_CONTENT §9): القيمة في المسودة (أو الافتراضي)، والمنشور،
 * ورمز القفل، وهل تغيّر الافتراضي بعد التعديل.
 */
export type TextStatus = "default" | "published" | "draft" | "baseChanged";

export interface LocaleState {
  /** ما يظهر في الحقل: تجاوز المسودة، أو الافتراضي. */
  readonly value: string;
  readonly published: string | null;
  /** للمسودة تجاوز قائم (يظهر معه «عودة إلى الافتراضي»). */
  readonly overridden: boolean;
  readonly lockToken: string;
  readonly status: TextStatus;
}

function statusOf(
  entry: TextEntry,
  locale: ContentLocale,
  draft: TextOverride | undefined,
  published: TextOverride | undefined,
): TextStatus {
  if (draft !== undefined && draft.baseHash !== entry.defaultHash[locale]) {
    return "baseChanged";
  }
  const value = draft?.value ?? entry.defaults[locale];
  if (value !== (published?.value ?? entry.defaults[locale])) {
    return "draft";
  }
  return published === undefined ? "default" : "published";
}

export function localeState(
  entry: TextEntry,
  locale: ContentLocale,
  state: ContentState,
  rows: ReadonlyMap<string, DraftRow>,
): LocaleState {
  const draft = state.draft.texts.get(entry.path)?.[locale];
  const published = state.published.texts.get(entry.path)?.[locale];
  const value = draft?.value ?? entry.defaults[locale];
  return {
    value,
    published: published?.value ?? null,
    overridden: draft !== undefined,
    lockToken: rows.get(`${textKey(entry.path)}|${locale}`)?.lockToken ?? "",
    status: statusOf(entry, locale, draft, published),
  };
}

export type EntryState = Readonly<Record<ContentLocale, LocaleState>>;

export function entryStates(
  entries: readonly TextEntry[],
  state: ContentState,
): ReadonlyMap<string, EntryState> {
  const rows = new Map(state.rows.map((row) => [`${row.key}|${row.locale}`, row]));
  return new Map(
    entries.map((entry) => [
      entry.path,
      {
        ar: localeState(entry, "ar", state, rows),
        en: localeState(entry, "en", state, rows),
      },
    ]),
  );
}

/** أبرز حالة للنص باللغتين معًا: تغيّر الافتراضي، ثم المسودة، ثم المنشور. */
export function combinedStatus(states: EntryState): TextStatus {
  const order: readonly TextStatus[] = ["baseChanged", "draft", "published", "default"];
  return (
    order.find((status) => CONTENT_LOCALES.some((locale) => states[locale].status === status)) ??
    "default"
  );
}
