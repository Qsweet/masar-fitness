import "server-only";
import {
  createStaffSession,
  findStaffCredentialsByEmail,
  hashPassword,
  inTransaction,
  issueSessionToken,
  lockUsableStaff,
  needsRehash,
  recordFailedAttempt,
  recordPasswordAccepted,
  recordRejectedLogin,
  verifyAgainstDummy,
  verifyPassword,
  type StaffCredentials,
} from "@masar/db";
import { isLockedOut, normalizePassword, ok, parseStaffEmail, sessionExpiry } from "@masar/domain";
import { MAX_PASSWORD_INPUT_LENGTH } from "@/config/admin";
import { getDb } from "../db";
import { fallbackAuditClubId } from "./club";
import type { RequestMeta } from "./request-meta";
import { allowLoginAttempt } from "./throttle";

export interface LoginInput {
  readonly email: string;
  readonly password: string;
  readonly meta: RequestMeta;
  readonly now: Date;
}

export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: Date;
}

/** null لكل فشل: المستدعي يعرض رسالة واحدة لا تفرّق بين بريد مجهول وكلمة خاطئة وقفل وتعطيل وحد. */
export type LoginResult = IssuedSession | null;

type Refusal = "unknown_account" | "locked" | "disabled";

function refusalOf(staff: StaffCredentials | null, now: Date): Refusal | null {
  if (staff === null) {
    return "unknown_account";
  }
  if (staff.status !== "active") {
    return "disabled";
  }
  return isLockedOut(staff, now) ? "locked" : null;
}

/** حساب لا يُفحص: يُستهلك زمن تحقق حقيقي (لا تسريب وجود البريد بالتوقيت)، ويُسجَّل الرفض. */
async function refuse(staff: StaffCredentials | null, reason: Refusal, input: LoginInput) {
  await verifyAgainstDummy(input.password);
  const clubId = staff?.clubId ?? (await fallbackAuditClubId());
  if (clubId !== null) {
    await recordRejectedLogin(getDb(), {
      clubId,
      staffId: staff?.id ?? null,
      reason,
      ip: input.meta.ip,
      at: input.now,
    });
  }
  return null;
}

/**
 * كلمة المرور صحيحة: تُنشأ جلسة برمز جديد قبل الخطوة الثانية (بلا إثباتها)، إلا إن قُفل الحساب أو
 * عُطّل في الأثناء (يُفحص تحت قفل الصف)، فالنتيجة فشل كأي فشل.
 */
async function openSession(staff: StaffCredentials, password: string, input: LoginInput) {
  const issued = issueSessionToken();
  const expiresAt = sessionExpiry(input.now);
  const rehashedPassword = needsRehash(staff.passwordHash)
    ? await hashPassword(password)
    : undefined;
  const opened = await inTransaction(getDb(), async (tx) => {
    // القفل والحالة يُعاد فحصهما تحت قفل الصف: ما قُرئ قبل التجزئة قديم
    if (!(await lockUsableStaff(tx, staff.id, input.now))) {
      return ok(false);
    }
    await recordPasswordAccepted(tx, {
      staffId: staff.id,
      clubId: staff.clubId,
      ip: input.meta.ip,
      at: input.now,
      ...(rehashedPassword === undefined ? {} : { rehashedPassword }),
    });
    await createStaffSession(tx, {
      staffUserId: staff.id,
      tokenHash: issued.tokenHash,
      now: input.now,
      expiresAt,
      mfaVerifiedAt: null,
      ip: input.meta.ip,
      userAgent: input.meta.userAgent,
    });
    return ok(true);
  });
  return opened.ok && opened.value ? { token: issued.token, expiresAt } : null;
}

/**
 * محاولة دخول ببريد وكلمة مرور (docs/ADMIN_DESIGN.md §4.3 و§4.6). الترتيب ثابت: حد المحاولات
 * (العنوان والبريد) ← شكل البريد ← الحساب وحالته ← كلمة المرور بزمن ثابت ← العدّ أو الجلسة.
 */
export async function attemptLogin(input: LoginInput): Promise<LoginResult> {
  const email = parseStaffEmail(input.email);
  const throttleKey = email.ok ? email.value : input.email.trim().toLowerCase();
  const oversized = input.password.length > MAX_PASSWORD_INPUT_LENGTH;
  if (!allowLoginAttempt(input.meta.ip, throttleKey) || oversized) {
    return null;
  }
  const staff = email.ok ? await findStaffCredentialsByEmail(getDb(), email.value) : null;
  const refusal = refusalOf(staff, input.now);
  if (staff === null || refusal !== null) {
    return refuse(staff, refusal ?? "unknown_account", input);
  }
  const password = normalizePassword(input.password);
  if (!(await verifyPassword(password, staff.passwordHash))) {
    await recordFailedAttempt(getDb(), {
      staffId: staff.id,
      clubId: staff.clubId,
      ip: input.meta.ip,
      at: input.now,
      credential: "password",
    });
    return null;
  }
  return openSession(staff, password, input);
}
