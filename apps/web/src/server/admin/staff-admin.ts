import "server-only";
import {
  changeStaffStanding,
  createStaff,
  findStaffInClub,
  hashPassword,
  inTransaction,
  issueTemporaryPassword,
  resetTotp,
  setStaffPassword,
  staffActor,
  type StaffAccount,
} from "@masar/db";
import {
  DomainError,
  err,
  ok,
  parseStaffEmail,
  parseStaffName,
  type Result,
  type StaffRole,
  type StaffStatus,
} from "@masar/domain";
import { getDb } from "../db";
import type { StaffContext } from "./session";

/**
 * إدارة الموظفين للمالك (docs/ADMIN_DESIGN.md §4.8). كل دالة تأخذ سياق الحارس، فلا تُستدعى بلا
 * `requireStaff("staff.manage")`. المالك لا يغيّر حسابه هو من هنا (كلمته وجلساته في «حسابي»،
 * وخطوته الثانية بأمر الخادم)، فلا يقفل نفسه خارج اللوحة بضغطة.
 */
export interface NewStaffInput {
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRole;
}

export interface CreatedStaff {
  readonly staff: StaffAccount;
  /** تُعرض للمالك مرة واحدة ليسلّمها للموظف، ولا تُحفظ إلا مجزأة. */
  readonly temporaryPassword: string;
}

export async function createStaffMember(
  context: StaffContext,
  input: NewStaffInput,
  now: Date,
): Promise<Result<CreatedStaff, DomainError>> {
  const email = parseStaffEmail(input.email);
  if (!email.ok) {
    return email;
  }
  const displayName = parseStaffName(input.displayName);
  if (!displayName.ok) {
    return displayName;
  }
  const temporaryPassword = issueTemporaryPassword();
  const created = await createStaff(getDb(), {
    clubId: context.staff.clubId,
    email: email.value,
    displayName: displayName.value,
    role: input.role,
    passwordHash: await hashPassword(temporaryPassword),
    mustChangePassword: true,
    actor: staffActor(context.staff.id),
    at: now,
  });
  return created.ok ? ok({ staff: created.value, temporaryPassword }) : created;
}

/** الموظف الهدف من نادي المالك، وليس المالك نفسه. */
async function targetOf(
  context: StaffContext,
  staffId: string,
): Promise<Result<StaffAccount, DomainError>> {
  if (staffId === context.staff.id) {
    return err(new DomainError("conflict", "staff.self_change"));
  }
  const target = await findStaffInClub(getDb(), context.staff.clubId, staffId);
  return target === null ? err(new DomainError("not_found", "staff.not_found")) : ok(target);
}

export async function changeStaffMember(
  context: StaffContext,
  staffId: string,
  next: { readonly role?: StaffRole; readonly status?: StaffStatus },
  now: Date,
): Promise<Result<StaffAccount, DomainError>> {
  const target = await targetOf(context, staffId);
  if (!target.ok) {
    return target;
  }
  return changeStaffStanding(getDb(), {
    clubId: context.staff.clubId,
    staffId,
    next,
    actor: staffActor(context.staff.id),
    at: now,
  });
}

/** يمحو خطوة الموظف الثانية ويلغي جلساته: يسجّلها من جديد عند دخوله التالي. */
export async function resetStaffMfa(
  context: StaffContext,
  staffId: string,
  now: Date,
): Promise<Result<null, DomainError>> {
  const target = await targetOf(context, staffId);
  if (!target.ok) {
    return target;
  }
  return inTransaction(getDb(), async (tx) => {
    await resetTotp(tx, { staff: target.value, actor: staffActor(context.staff.id), at: now });
    return ok(null);
  });
}

/** كلمة مرور مؤقتة جديدة لموظف نسي كلمته: تُلغى جلساته ويغيّرها عند دخوله التالي. */
export async function resetStaffPassword(
  context: StaffContext,
  staffId: string,
  now: Date,
): Promise<Result<string, DomainError>> {
  const target = await targetOf(context, staffId);
  if (!target.ok) {
    return target;
  }
  const temporaryPassword = issueTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  return inTransaction(getDb(), async (tx) => {
    await setStaffPassword(tx, {
      clubId: context.staff.clubId,
      staffId,
      passwordHash,
      action: "password_reset",
      mustChangePassword: true,
      actor: staffActor(context.staff.id),
      at: now,
    });
    return ok(temporaryPassword);
  });
}
