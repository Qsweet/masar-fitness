"use server";

import { redirect } from "next/navigation";
import { ADMIN_ROUTES } from "@/config/admin";
import { failed, idField, textField, type AdminFormState } from "../form";
import { requireStaff } from "../guard";
import { MAX_PUBLISH_TOKEN_LENGTH } from "../content/publish-token";
import { discardDraftOf, publishDraft, rollbackTo } from "../content/publishing";

const DIGEST_LENGTH = 64;

/** نشر المسودة كلها إصدارًا بما راجعه الناشر في الرمز المختوم. */
export async function publishContentAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("content.publish");
  const token = textField(formData, "token", MAX_PUBLISH_TOKEN_LENGTH);
  const published = await publishDraft(context, token, new Date());
  if (!published.ok) {
    return failed(published.error.reason);
  }
  redirect(`${ADMIN_ROUTES.content}?done=content_published`);
}

/** استرجاع إصدار سابق بإصدار جديد. مرفوض والمسودة متغيرة. */
export async function rollbackContentAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("content.publish");
  const releaseId = idField(formData, "releaseId");
  const expectedLatestId = idField(formData, "expectedLatestId");
  if (releaseId === null || expectedLatestId === null) {
    return failed("staff.invalid_request");
  }
  const rolled = await rollbackTo(context, { releaseId, expectedLatestId }, new Date());
  if (!rolled.ok) {
    return failed(rolled.error.reason);
  }
  redirect(`${ADMIN_ROUTES.contentHistory}?done=content_rolled_back`);
}

/** إعادة المسودة إلى آخر إصدار بما راجعه الموظف (بصمتها). */
export async function discardDraftAction(
  _previous: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const context = await requireStaff("content.publish");
  const digest = textField(formData, "digest", DIGEST_LENGTH);
  const discarded = await discardDraftOf(context, digest, new Date());
  if (!discarded.ok) {
    return failed(discarded.error.reason);
  }
  redirect(`${ADMIN_ROUTES.content}?done=content_draft_discarded`);
}
