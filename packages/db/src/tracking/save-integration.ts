import { DomainError, err, ok, TRACKING_FIELDS, type Result } from "@masar/domain";
import type { Db } from "../client";
import { writeAudit } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";
import {
  configOf,
  PHONE_FLAG,
  TRACKING_AUDIT_ACTION,
  TRACKING_AUDIT_ENTITY,
  type SaveIntegrationInput,
} from "./integrations";

interface LockedRow {
  readonly enabled: boolean;
  readonly config: unknown;
  readonly secret_enc: string | null;
  readonly test_event_code: string | null;
}

export interface SavedIntegration {
  /** لا فرق عن المحفوظ: لا كتابة ولا سطر تدقيق. */
  readonly changed: boolean;
}

async function lockRow(tx: Tx, input: SaveIntegrationInput): Promise<LockedRow | undefined> {
  // قفل النادي يسلسل الحفظين المتزامنين للمنصة نفسها حتى حين لا صف لها بعد
  await tx.$queryRaw`SELECT id FROM clubs WHERE id = ${input.clubId}::uuid FOR UPDATE`;
  const rows = await tx.$queryRaw<LockedRow[]>`
    SELECT enabled, config, secret_enc, test_event_code FROM tracking_integrations
    WHERE club_id = ${input.clubId}::uuid AND provider = ${input.provider} FOR UPDATE`;
  return rows[0];
}

/** أسماء الحقول التي تغيّرت، لا قيمها (المعرّفات عامة، لكن السجل لا يحتاجها). */
function changedFields(before: LockedRow | undefined, input: SaveIntegrationInput): string[] {
  const old = configOf(before?.config);
  const fields: string[] = TRACKING_FIELDS.filter(
    (field) => (old[field] ?? null) !== (input.config[field] ?? null),
  );
  const phoneChanged = (old.sendHashedPhone ?? null) !== (input.config.sendHashedPhone ?? null);
  return phoneChanged ? [...fields, PHONE_FLAG] : fields;
}

function secretAfter(before: LockedRow | undefined, input: SaveIntegrationInput) {
  switch (input.secret.kind) {
    case "keep":
      return { enc: before?.secret_enc ?? null, changed: false };
    case "clear":
      return { enc: null, changed: (before?.secret_enc ?? null) !== null };
    case "set":
      return { enc: input.secret.sealed, changed: true };
  }
}

async function write(tx: Tx, input: SaveIntegrationInput, before: LockedRow | undefined) {
  const secret = secretAfter(before, input);
  const last4 = input.secret.kind === "set" ? input.secret.last4 : null;
  const config = JSON.stringify(input.config);
  await tx.$executeRaw`
    INSERT INTO tracking_integrations
      (club_id, provider, enabled, config, secret_enc, secret_last4, test_event_code, updated_at, updated_by)
    VALUES (${input.clubId}::uuid, ${input.provider}, ${input.enabled}, ${config}::jsonb,
      ${secret.enc}, ${last4}, ${input.testEventCode}, ${input.now}, ${input.staffId}::uuid)
    ON CONFLICT (club_id, provider) DO UPDATE SET enabled = EXCLUDED.enabled,
      config = EXCLUDED.config, secret_enc = EXCLUDED.secret_enc,
      secret_last4 = CASE WHEN ${input.secret.kind} = 'keep' THEN tracking_integrations.secret_last4
        ELSE EXCLUDED.secret_last4 END,
      test_event_code = EXCLUDED.test_event_code, updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by`;
  return secret.changed;
}

function hasChanges(
  before: LockedRow | undefined,
  input: SaveIntegrationInput,
  fields: readonly string[],
  testCodeChanged: boolean,
): boolean {
  const enabledChanged = (before?.enabled ?? false) !== input.enabled;
  return enabledChanged || fields.length > 0 || testCodeChanged || input.secret.kind !== "keep";
}

function stateOf(row: LockedRow | undefined): string | null {
  if (row === undefined) {
    return null;
  }
  return row.enabled ? "enabled" : "disabled";
}

async function saveInTransaction(
  tx: Tx,
  input: SaveIntegrationInput,
): Promise<Result<SavedIntegration, DomainError>> {
  const before = await lockRow(tx, input);
  const fields = changedFields(before, input);
  const testCodeChanged = (before?.test_event_code ?? null) !== input.testEventCode;
  if (!hasChanges(before, input, fields, testCodeChanged)) {
    return ok({ changed: false });
  }
  const secretChanged = await write(tx, input, before);
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: TRACKING_AUDIT_ENTITY,
    entityId: input.clubId,
    action: TRACKING_AUDIT_ACTION,
    fromState: stateOf(before),
    toState: input.enabled ? "enabled" : "disabled",
    actor: input.actor,
    data: {
      platform: input.provider,
      ...(fields.length === 0 ? {} : { changed: fields.join(",") }),
      testEventCodeChanged: testCodeChanged,
      secretChanged,
    },
    at: input.now,
  });
  return ok({ changed: true });
}

/** يحفظ إعداد منصة بسطر تدقيق فيه ما تغيّر (أسماء الحقول، وهل تغيّر المفتاح) بلا أي قيمة سرية. */
export async function saveIntegration(
  db: Db,
  input: SaveIntegrationInput,
): Promise<Result<SavedIntegration, DomainError>> {
  const club = await db.club.findUnique({ where: { id: input.clubId }, select: { id: true } });
  if (club === null) {
    return err(new DomainError("not_found", "club.not_found"));
  }
  return inTransaction(db, (tx) => saveInTransaction(tx, input));
}
