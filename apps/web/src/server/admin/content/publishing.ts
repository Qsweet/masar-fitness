import "server-only";
import { discardDraft, publishContent, rollbackContent, staffActor } from "@masar/db";
import { err, ok, DomainError, type Result } from "@masar/domain";
import { getDb } from "../../db";
import { textRegistry } from "../../content/registry";
import { knownSlidePaths } from "../../content/slider-links";
import { adminSecretKey } from "../flag";
import type { StaffContext } from "../session";
import { openPublishToken } from "./publish-token";
import { buildRelease, draftDigest, isDraftDirty, rebuildRelease } from "./release";

/**
 * أفعال النشر باسم الموظف (ADMIN_A3_CONTENT §8.4–8.5): كلٌّ يعيد قراءة كل شيء تحت قفل المحتوى، ولا
 * يثق إلا بما ختمه الخادم أو بمعرّفات يتحقق منها. النجاح يسري في الطلب العام التالي (لا ذاكرة تُبطَل).
 */
function who(context: StaffContext, now: Date) {
  const { staff } = context;
  return { clubId: staff.clubId, staffId: staff.id, actor: staffActor(staff.id), now };
}

export async function publishDraft(
  context: StaffContext,
  token: string,
  now: Date,
): Promise<Result<number, DomainError>> {
  const reviewed = openPublishToken(adminSecretKey(), context.staff.id, token, now);
  if (reviewed === null) {
    return err(new DomainError("validation", "content.publish_token_invalid"));
  }
  const release = { registry: textRegistry(), knownPaths: await knownSlidePaths() };
  const published = await publishContent(getDb(), {
    ...who(context, now),
    expectedDigest: reviewed.digest,
    expectedLatestId: reviewed.latestId,
    build: (rows, previous, slider) => buildRelease(rows, previous, slider, release),
  });
  return published.ok ? ok(published.value.seq) : published;
}

export async function rollbackTo(
  context: StaffContext,
  input: { readonly releaseId: string; readonly expectedLatestId: string },
  now: Date,
): Promise<Result<number, DomainError>> {
  const release = { registry: textRegistry(), knownPaths: await knownSlidePaths() };
  const rolled = await rollbackContent(getDb(), {
    ...who(context, now),
    ...input,
    isDirty: (rows, published, slider) => isDraftDirty(rows, published, slider, release.registry),
    rebuild: (target, previous) => rebuildRelease(target, previous, release),
  });
  return rolled.ok ? ok(rolled.value.seq) : rolled;
}

export async function discardDraftOf(
  context: StaffContext,
  expectedDraftDigest: string,
  now: Date,
): Promise<Result<number, DomainError>> {
  const registry = textRegistry();
  return discardDraft(getDb(), {
    ...who(context, now),
    expectedDraftDigest,
    draftDigest: (rows, slider) => draftDigest(rows, registry, slider),
    isDirty: (rows, published, slider) => isDraftDirty(rows, published, slider, registry),
  });
}
