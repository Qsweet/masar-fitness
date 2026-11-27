/**
 * النشر والاسترجاع وتجاهل المسودة (ADMIN_A3_CONTENT §8.4–8.5). كلٌّ في معاملة واحدة تحت قفل محتوى
 * النادي مع سطر تدقيقه. الإصدار لا يُعدَّل ولا يُحذف (C1): الاسترجاع إصدار جديد بلقطة قديمة،
 * والمسودة تُستبدل بها في المعاملة نفسها، وإلا أعاد النشر التالي ما استُرجع منه.
 */
import { randomUUID } from "node:crypto";
import {
  DomainError,
  err,
  ok,
  snapshotEntries,
  snapshotShape,
  SNAPSHOT_VERSION,
  textKey,
  type Result,
  type Snapshot,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import { listDraftEntries, type DraftRow } from "./drafts";
import { lockContent } from "./lock";
import { findRelease, latestRelease, type ReleaseHead } from "./read-release";

export const CONTENT_AUDIT_ACTIONS = [
  "content_draft_saved",
  "content_published",
  "content_rolled_back",
  "content_draft_discarded",
] as const;

export interface ContentActor {
  readonly clubId: string;
  readonly staffId: string;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface ReleaseBuild {
  readonly snapshot: Snapshot;
  readonly digest: string;
  readonly changedCount: number;
}

export interface PublishInput extends ContentActor {
  /** ما راجعه الناشر: بصمة المسودة ومعرّف آخر إصدار وقت عرض الفرق. */
  readonly expectedDigest: string;
  readonly expectedLatestId: string | null;
  /** يتحقق من كل صف كاملًا ويبني اللقطة (السجل في الويب)، أو يرفض النشر كله. */
  readonly build: (
    rows: readonly DraftRow[],
    previous: unknown,
  ) => Result<ReleaseBuild, DomainError>;
}

export interface PublishedRelease {
  readonly id: string;
  readonly seq: number;
}

const EMPTY_SNAPSHOT: Snapshot = { v: SNAPSHOT_VERSION, texts: {} };

function conflict(reason: string): Result<never, DomainError> {
  return err(new DomainError("conflict", reason));
}

async function insertRelease(
  tx: Tx,
  input: ContentActor,
  release: ReleaseBuild & { readonly seq: number; readonly rolledBackFrom: string | null },
): Promise<PublishedRelease> {
  const id = randomUUID();
  const source = release.rolledBackFrom === null ? "publish" : "rollback";
  await tx.$executeRaw`
    INSERT INTO content_releases (id, club_id, seq, snapshot, schema_version, digest, source,
      changed_count, rolled_back_from, published_by, published_at)
    VALUES (${id}::uuid, ${input.clubId}::uuid, ${release.seq}, ${JSON.stringify(release.snapshot)}::jsonb,
      ${SNAPSHOT_VERSION}, ${release.digest}, ${source}, ${release.changedCount},
      ${release.rolledBackFrom}::uuid, ${input.staffId}::uuid, ${input.now})`;
  return { id, seq: release.seq };
}

async function audit(
  tx: Tx,
  input: ContentActor,
  entity: string,
  action: string,
  data: Readonly<Record<string, string | number>>,
) {
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: action === "content_draft_discarded" ? "content_draft" : "content_release",
    entityId: entity,
    action,
    fromState: null,
    toState: null,
    actor: input.actor,
    data,
    at: input.now,
  });
}

async function previousSnapshot(
  tx: Tx,
  clubId: string,
  head: ReleaseHead | null,
): Promise<unknown> {
  return head === null ? null : ((await findRelease(tx, clubId, head.id))?.snapshot ?? null);
}

async function publishInTransaction(
  tx: Tx,
  input: PublishInput,
): Promise<Result<PublishedRelease, DomainError>> {
  await lockContent(tx, input.clubId);
  const head = await latestRelease(tx, input.clubId);
  if ((head?.id ?? null) !== input.expectedLatestId) {
    return conflict("content.draft_changed");
  }
  const built = input.build(
    await listDraftEntries(tx, input.clubId),
    await previousSnapshot(tx, input.clubId, head),
  );
  if (!built.ok) {
    return built;
  }
  if (built.value.digest !== input.expectedDigest) {
    return conflict("content.draft_changed");
  }
  if (built.value.changedCount === 0) {
    return err(new DomainError("validation", "content.nothing_to_publish"));
  }
  const release = await insertRelease(tx, input, {
    ...built.value,
    seq: (head?.seq ?? 0) + 1,
    rolledBackFrom: null,
  });
  await audit(tx, input, release.id, "content_published", {
    seq: release.seq,
    changedCount: built.value.changedCount,
    digest: built.value.digest,
  });
  return ok(release);
}

/** ينشر المسودة كلها إصدارًا جديدًا، أو يرفض: تغيّرت بعد المراجعة، أو لا تغيير، أو صف لا يصح. */
export function publishContent(
  db: Db,
  input: PublishInput,
): Promise<Result<PublishedRelease, DomainError>> {
  return inTransaction(db, (tx) => publishInTransaction(tx, input));
}

/** يستبدل المسودة بلقطة: يحذف صفوفها ويكتب صفوف اللقطة برموز قفل أحدث من كل ما سبق. */
async function replaceDraft(
  tx: Tx,
  input: ContentActor,
  snapshot: Snapshot,
  rows: readonly DraftRow[],
) {
  const latest = Math.max(input.now.getTime(), ...rows.map((row) => row.updatedAt.getTime() + 1));
  const at = new Date(latest);
  await tx.$executeRaw`DELETE FROM content_draft_entries WHERE club_id = ${input.clubId}::uuid`;
  for (const entry of snapshotEntries(snapshot)) {
    await tx.$executeRaw`
      INSERT INTO content_draft_entries (club_id, entry_key, locale, value, updated_by, updated_at)
      VALUES (${input.clubId}::uuid, ${textKey(entry.path)}, ${entry.locale},
        ${JSON.stringify(entry.value)}::jsonb, ${input.staffId}::uuid, ${at})`;
  }
}

export interface RollbackInput extends ContentActor {
  readonly releaseId: string;
  readonly expectedLatestId: string;
  /** بصمة المسودة الفعلية (بالسجل في الويب): تختلف عن آخر إصدار ⇒ المسودة متغيرة. */
  readonly draftDigest: (rows: readonly DraftRow[]) => string;
  readonly changedCount: (from: unknown, to: unknown) => number;
}

async function rollbackInTransaction(
  tx: Tx,
  input: RollbackInput,
): Promise<Result<PublishedRelease, DomainError>> {
  await lockContent(tx, input.clubId);
  const head = await latestRelease(tx, input.clubId);
  const target = await findRelease(tx, input.clubId, input.releaseId);
  if (head === null || target === null) {
    return err(new DomainError("not_found", "content.release_not_found"));
  }
  if (head.id !== input.expectedLatestId) {
    return conflict("content.draft_changed");
  }
  if (target.id === head.id) {
    return err(new DomainError("validation", "content.rollback_to_current"));
  }
  const rows = await listDraftEntries(tx, input.clubId);
  if (input.draftDigest(rows) !== head.digest) {
    return conflict("content.rollback_draft_dirty");
  }
  const snapshot = snapshotShape(target.snapshot) ?? EMPTY_SNAPSHOT;
  const changedCount = input.changedCount(
    await previousSnapshot(tx, input.clubId, head),
    target.snapshot,
  );
  const release = await insertRelease(tx, input, {
    snapshot,
    digest: target.digest,
    changedCount,
    seq: head.seq + 1,
    rolledBackFrom: target.id,
  });
  await replaceDraft(tx, input, snapshot, rows);
  await audit(tx, input, release.id, "content_rolled_back", {
    seq: release.seq,
    fromSeq: target.seq,
  });
  return ok(release);
}

/** يعيد الموقع إلى إصدار سابق بإصدار جديد، والمسودة إليه. مرفوض والمسودة متغيرة: انشر أو تجاهل أولًا. */
export function rollbackContent(
  db: Db,
  input: RollbackInput,
): Promise<Result<PublishedRelease, DomainError>> {
  return inTransaction(db, (tx) => rollbackInTransaction(tx, input));
}

export interface DiscardInput extends ContentActor {
  readonly expectedDraftDigest: string;
  readonly draftDigest: (rows: readonly DraftRow[]) => string;
}

async function discardInTransaction(
  tx: Tx,
  input: DiscardInput,
): Promise<Result<number, DomainError>> {
  await lockContent(tx, input.clubId);
  const head = await latestRelease(tx, input.clubId);
  const rows = await listDraftEntries(tx, input.clubId);
  if (input.draftDigest(rows) !== input.expectedDraftDigest) {
    return conflict("content.draft_changed");
  }
  if (rows.length === 0) {
    return err(new DomainError("validation", "content.nothing_to_discard"));
  }
  const snapshot = snapshotShape(await previousSnapshot(tx, input.clubId, head)) ?? EMPTY_SNAPSHOT;
  await replaceDraft(tx, input, snapshot, rows);
  await audit(tx, input, input.clubId, "content_draft_discarded", { seq: head?.seq ?? 0 });
  return ok(rows.length);
}

/** يعيد المسودة إلى آخر إصدار (أو الافتراضي قبل أي نشر). */
export function discardDraft(db: Db, input: DiscardInput): Promise<Result<number, DomainError>> {
  return inTransaction(db, (tx) => discardInTransaction(tx, input));
}
