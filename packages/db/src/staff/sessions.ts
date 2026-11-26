/**
 * جلسات الموظفين (ADMIN_DESIGN §4.5). الرمز يُخزَّن مجزأً، والتدوير صف جديد يرث الحد المطلق من
 * الجلسة الأصلية، فتغيير الرمز لا يمدّ عمر الدخول.
 */
import { DomainError, err, ok, SESSION_IDLE_MS, type Result } from "@masar/domain";
import type { Db } from "../client";
import { inTransaction, type Tx } from "../commerce/transaction";
import type { StaffSession } from "../generated/prisma/client";
import { toAccount, type StaffAccount } from "./accounts";
import { staffActor, writeStaffAudit } from "./audit";

const MAX_USER_AGENT_LENGTH = 255;

export interface StaffSessionView {
  readonly id: string;
  readonly staffUserId: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly mfaVerifiedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly ip: string;
  readonly userAgent: string;
}

function toView(row: StaffSession): StaffSessionView {
  return {
    id: row.id,
    staffUserId: row.staffUserId,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    mfaVerifiedAt: row.mfaVerifiedAt,
    revokedAt: row.revokedAt,
    ip: row.ip,
    userAgent: row.userAgent,
  };
}

export interface NewStaffSession {
  readonly staffUserId: string;
  readonly tokenHash: string;
  readonly now: Date;
  readonly expiresAt: Date;
  readonly mfaVerifiedAt: Date | null;
  readonly ip: string;
  readonly userAgent: string;
}

export async function createStaffSession(db: Db | Tx, input: NewStaffSession): Promise<string> {
  const row = await db.staffSession.create({
    data: {
      staffUserId: input.staffUserId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      expiresAt: input.expiresAt,
      mfaVerifiedAt: input.mfaVerifiedAt,
      ip: input.ip,
      userAgent: input.userAgent.slice(0, MAX_USER_AGENT_LENGTH),
    },
  });
  return row.id;
}

export interface SessionWithStaff {
  readonly session: StaffSessionView;
  readonly staff: StaffAccount;
}

export async function findSessionByTokenHash(
  db: Db | Tx,
  tokenHash: string,
): Promise<SessionWithStaff | null> {
  const row = await db.staffSession.findUnique({
    where: { tokenHash },
    include: { staffUser: true },
  });
  return row === null ? null : { session: toView(row), staff: toAccount(row.staffUser) };
}

/** يسجّل نشاطًا على جلسة حيّة فقط. */
export async function touchStaffSession(db: Db | Tx, id: string, now: Date): Promise<void> {
  await db.staffSession.updateMany({
    where: { id, revokedAt: null, lastSeenAt: { lt: now } },
    data: { lastSeenAt: now },
  });
}

/** يلغي كل جلسات الموظف الحيّة (عدا واحدة إن ذُكرت)، ويرجع عددها. */
export async function revokeAllStaffSessions(
  db: Db | Tx,
  staffUserId: string,
  at: Date,
  exceptId?: string,
): Promise<number> {
  const result = await db.staffSession.updateMany({
    where: {
      staffUserId,
      revokedAt: null,
      ...(exceptId === undefined ? {} : { NOT: { id: exceptId } }),
    },
    data: { revokedAt: at },
  });
  return result.count;
}

export interface RevokeSessionInput {
  readonly sessionId: string;
  /** صاحب الجلسة: لا يلغي أحد جلسة غيره من «جلساتي». */
  readonly staff: Pick<StaffAccount, "id" | "clubId">;
  readonly action: "logout" | "session_revoked";
  readonly at: Date;
}

/** يلغي جلسة يملكها الموظف ويسجّلها. جلسة ليست له أو ملغاة: `not_found` بلا أثر. */
export function revokeStaffSession(
  db: Db,
  input: RevokeSessionInput,
): Promise<Result<null, DomainError>> {
  return inTransaction(db, async (tx) => {
    const result = await tx.staffSession.updateMany({
      where: { id: input.sessionId, staffUserId: input.staff.id, revokedAt: null },
      data: { revokedAt: input.at },
    });
    if (result.count === 0) {
      return err(new DomainError("not_found", "staff.session_not_found"));
    }
    await writeStaffAudit(tx, {
      clubId: input.staff.clubId,
      staffId: input.staff.id,
      action: input.action,
      actor: staffActor(input.staff.id),
      data: { session: input.sessionId },
      at: input.at,
    });
    return ok(null);
  });
}

export interface RotateSessionInput {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly now: Date;
  /** يُكتب على الجلسة الجديدة حين يكون التدوير إتمامًا للخطوة الثانية؛ وإلا تُورَّث قيمة القديمة. */
  readonly mfaVerifiedAt?: Date;
}

/**
 * رمز جديد للجلسة: تُلغى القديمة وتُنشأ أخرى بالحد المطلق نفسه. يرجع معرّف الجديدة، أو null إن
 * كانت القديمة ملغاة (سباق مع خروج).
 */
export async function rotateStaffSession(
  tx: Tx,
  input: RotateSessionInput,
): Promise<string | null> {
  const old = await tx.staffSession.findUnique({ where: { id: input.sessionId } });
  if (old?.revokedAt !== null) {
    return null;
  }
  await tx.staffSession.update({ where: { id: old.id }, data: { revokedAt: input.now } });
  return createStaffSession(tx, {
    staffUserId: old.staffUserId,
    tokenHash: input.tokenHash,
    now: input.now,
    expiresAt: old.expiresAt,
    mfaVerifiedAt: input.mfaVerifiedAt ?? old.mfaVerifiedAt,
    ip: old.ip,
    userAgent: old.userAgent,
  });
}

/** الجلسات الحيّة للموظف الآن (غير ملغاة ولا منتهية ولا خاملة)، الأحدث نشاطًا أولًا. */
export async function listLiveStaffSessions(
  db: Db | Tx,
  staffUserId: string,
  now: Date,
): Promise<StaffSessionView[]> {
  const rows = await db.staffSession.findMany({
    where: {
      staffUserId,
      revokedAt: null,
      expiresAt: { gt: now },
      lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_MS) },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map(toView);
}
