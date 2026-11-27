"use server";

import { redirect } from "next/navigation";
import { contentNamespacePath } from "@/config/admin";
import { textRegistry } from "@/server/content/registry";
import { rejectedForm, type FieldFormState } from "../field-form";
import { textField } from "../form";
import { requireStaff } from "../guard";
import { saveNamespaceTexts } from "../content/save-texts";

const NAMESPACE_INPUT_LENGTH = 40;
const REVERT_INPUT_LENGTH = 140;
/** أكثر من حقلين لكل نص في أكبر مساحة؛ الطلب الأكبر مصنوع لا من النموذج. */
const MAX_FIELDS = 400;

/** حقول النموذج بالبادئة (`v:` للنص، `t:` لرمز القفل)، نصية وحدها. */
function prefixed(formData: FormData, prefix: string): Record<string, string> {
  const entries = [...formData.entries()]
    .filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith(prefix) && typeof entry[1] === "string",
    )
    .slice(0, MAX_FIELDS);
  return Object.fromEntries(entries);
}

/**
 * حفظ نصوص مساحة في المسودة، أو «عودة إلى الافتراضي» لنص ولغة (زر `revert`). لا يغيّر الموقع: النشر
 * خطوة مستقلة لمن يملك `content.publish`.
 */
export async function saveTextsAction(
  previous: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  const context = await requireStaff("content.write");
  const namespace = textField(formData, "namespace", NAMESPACE_INPUT_LENGTH);
  if (!textRegistry().namespaces.includes(namespace)) {
    return rejectedForm(previous.values, { error: "staff.invalid_request", fields: {} });
  }
  const values = prefixed(formData, "v:");
  const revert = textField(formData, "revert", REVERT_INPUT_LENGTH);
  const outcome = await saveNamespaceTexts(
    context,
    { namespace, values, tokens: prefixed(formData, "t:"), revert: revert === "" ? null : revert },
    new Date(),
  );
  if (!outcome.ok) {
    return rejectedForm(values, outcome.failure);
  }
  const done = revert === "" ? "content_draft_saved" : "content_text_reverted";
  redirect(`${contentNamespacePath(namespace)}?done=${done}`);
}
