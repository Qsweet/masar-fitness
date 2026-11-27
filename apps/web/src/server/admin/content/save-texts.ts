import "server-only";
import { DraftConflict, saveDraftEntries, staffActor, type DraftChange } from "@masar/db";
import {
  CONTENT_LOCALES,
  hasPermission,
  isContentLocale,
  TEXT_KEY_PREFIX,
  TEXT_LIMITS,
  textKey,
  validateTextOverride,
  type ContentLocale,
  type TextEntry,
} from "@masar/domain";
import { MAX_CONTENT_TEXT_INPUT } from "@/config/admin";
import { getAdminDictionary, lookup } from "@/i18n/admin";
import { getDb } from "../../db";
import type { FormFailure } from "../field-form";
import type { StaffContext } from "../session";
import { entryStates, type EntryState } from "./namespace-view";
import { loadContentState } from "./state";
import { textRegistry } from "../../content/registry";

/**
 * حفظ نصوص مساحة في المسودة (ADMIN_A3_CONTENT §3.3 و§8.2). يُكتب ما تغيّر عن المعروض وحده، وكل قيمة
 * تمر بالتحقق كاملًا؛ أي رفض يعيد النموذج بكل أخطائه ولا يُكتب شيء. حقائق النادي لمن يملك
 * `content.facts` وحده.
 */
export function valueField(locale: ContentLocale, path: string): string {
  return `v:${locale}:${path}`;
}

export function tokenField(locale: ContentLocale, path: string): string {
  return `t:${locale}:${path}`;
}

export interface TextsSubmission {
  readonly namespace: string;
  readonly values: Readonly<Record<string, string>>;
  readonly tokens: Readonly<Record<string, string>>;
  /** «اللغة:المسار» لزر «عودة إلى الافتراضي»، أو null للحفظ. */
  readonly revert: string | null;
}

export type SaveOutcome =
  | { readonly ok: true; readonly saved: number }
  | { readonly ok: false; readonly failure: FormFailure };

interface Planned {
  readonly changes: DraftChange[];
  readonly fields: Record<string, string>;
  readonly details: Record<string, string>;
}

function lintDetail(detail: string): string {
  const [rule = "", excerpt = ""] = detail.split("|");
  const rules = getAdminDictionary().content.lintRules;
  return `${lookup(rules, rule, rule)}: «${excerpt}»`;
}

function planLocale(
  entry: TextEntry,
  locale: ContentLocale,
  state: EntryState,
  input: TextsSubmission,
  plan: Planned,
) {
  const name = valueField(locale, entry.path);
  const raw = input.values[name];
  const current = state[locale];
  if (raw === undefined || raw === current.value) {
    return;
  }
  const lockToken = input.tokens[tokenField(locale, entry.path)] ?? "";
  if (raw.length > MAX_CONTENT_TEXT_INPUT) {
    plan.fields[name] = "content.too_long";
    plan.details[name] = String(TEXT_LIMITS[entry.kind]);
    return;
  }
  const result = validateTextOverride(entry, raw, locale);
  if (!result.ok) {
    plan.fields[name] = result.error.reason;
    const detail = result.error.detail;
    if (detail !== undefined) {
      plan.details[name] =
        result.error.reason === "content.copy_lint" ? lintDetail(detail) : detail;
    }
    return;
  }
  const key = textKey(entry.path);
  if (result.value.kind === "default") {
    if (current.overridden) {
      plan.changes.push({ key, locale, value: null, lockToken });
    }
    return;
  }
  plan.changes.push({
    key,
    locale,
    value: { value: result.value.value, baseHash: entry.defaultHash[locale] },
    lockToken,
  });
}

/**
 * «عودة إلى الافتراضي» حفظٌ للنموذج كله والنص المختار بقيمته الأصلية: ما كُتب في الحقول الأخرى لا يضيع.
 */
function withRevert(entries: readonly TextEntry[], input: TextsSubmission): TextsSubmission {
  const [locale = "", ...rest] = (input.revert ?? "").split(":");
  const entry = entries.find((candidate) => candidate.path === rest.join(":"));
  if (entry === undefined || !isContentLocale(locale)) {
    return input;
  }
  return {
    ...input,
    values: { ...input.values, [valueField(locale, entry.path)]: entry.defaults[locale] },
  };
}

/** الحقل الذي تغيّر صفه بعد فتح الصفحة (المعرّف «text:المسار|اللغة» من المستودع). */
function staleField(id: string): string {
  const [key = "", locale = ""] = id.split("|");
  return `v:${locale}:${key.slice(TEXT_KEY_PREFIX.length)}`;
}

function staleFailure(error: DraftConflict): FormFailure {
  return {
    error: null,
    fields: Object.fromEntries(error.stale.map((id) => [staleField(id), "content.stale_edit"])),
  };
}

export async function saveNamespaceTexts(
  context: StaffContext,
  input: TextsSubmission,
  now: Date,
): Promise<SaveOutcome> {
  const { staff } = context;
  const registry = textRegistry();
  const entries = [...registry.editable.values()].filter(
    (entry) => entry.namespace === input.namespace && hasPermission(staff.role, entry.permission),
  );
  const states = entryStates(entries, await loadContentState(staff.clubId, registry));
  const plan: Planned = { changes: [], fields: {}, details: {} };
  const submission = withRevert(entries, input);
  for (const entry of entries) {
    const state = states.get(entry.path);
    if (state !== undefined) {
      for (const locale of CONTENT_LOCALES) {
        planLocale(entry, locale, state, submission, plan);
      }
    }
  }
  if (Object.keys(plan.fields).length > 0) {
    return { ok: false, failure: { error: null, fields: plan.fields, fieldDetails: plan.details } };
  }
  if (plan.changes.length === 0) {
    return { ok: false, failure: { error: "content.no_changes", fields: {} } };
  }
  const saved = await saveDraftEntries(getDb(), {
    clubId: staff.clubId,
    staffId: staff.id,
    actor: staffActor(staff.id),
    target: input.namespace,
    changes: plan.changes,
    now,
  });
  if (saved.ok) {
    return { ok: true, saved: saved.value };
  }
  return {
    ok: false,
    failure:
      saved.error instanceof DraftConflict
        ? staleFailure(saved.error)
        : { error: saved.error.reason, fields: {} },
  };
}
