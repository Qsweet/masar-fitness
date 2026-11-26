import "server-only";
import {
  acceptTotpStep,
  completeTotpEnrolment,
  consumeRecoveryCode,
  findStaffCredentialsById,
  hmacSha1,
  inTransaction,
  issueRecoveryCodes,
  issueSessionToken,
  newTotpSecret,
  normalizeRecoveryCode,
  openSecret,
  recordFailedAttempt,
  recordMfaVerified,
  recoveryCodeHash,
  rotateStaffSession,
  savePendingTotpSecret,
  sealSecret,
  type StaffCredentials,
  type Tx,
} from "@masar/db";
import {
  base32Encode,
  DomainError,
  isLockedOut,
  matchTotpStep,
  ok,
  otpauthUri,
  parseTotpInput,
} from "@masar/domain";
import { TOTP_ISSUER } from "@/config/admin";
import { getDb } from "../db";
import { adminSecretKey } from "./flag";
import type { IssuedSession } from "./login";
import type { RequestMeta } from "./request-meta";
import type { StaffContext } from "./session";
import { allowMfaAttempt } from "./throttle";

export type MfaMethod = "totp" | "recovery";

export interface MfaAttempt {
  readonly context: StaffContext;
  readonly method: MfaMethod;
  /** ما كتبه الموظف كما هو. */
  readonly input: string;
  readonly meta: RequestMeta;
  readonly now: Date;
}

/** null لكل فشل (رمز خاطئ أو مستعمل، حد المحاولات، حساب مقفل): رسالة واحدة. */
export type MfaResult = IssuedSession | null;

async function credentialsOf(context: StaffContext): Promise<StaffCredentials> {
  const staff = await findStaffCredentialsById(getDb(), context.staff.id);
  if (staff === null) {
    throw new DomainError("invariant", "staff.missing_for_session");
  }
  return staff;
}

function totpKey(staff: StaffCredentials): Uint8Array | null {
  return staff.totpSecretEnc === null
    ? null
    : openSecret(adminSecretKey(), staff.totpSecretEnc, staff.id);
}

/** الخطوة الزمنية التي يطابقها الرمز لهذا الحساب، أو null. لا تُحفظ هنا. */
function matchingStep(staff: StaffCredentials, raw: string, now: Date): number | null {
  const code = parseTotpInput(raw);
  const key = totpKey(staff);
  if (code === null || key === null) {
    return null;
  }
  return matchTotpStep({
    hmac: hmacSha1,
    key,
    code,
    nowMs: now.getTime(),
    lastStep: staff.totpLastStep,
  });
}

/** هل يقبل هذا الحساب ما كُتب؟ القبول نفسه ذرّي في القاعدة: الخطوة أو رمز الاسترجاع يُستهلك مرة. */
async function consume(tx: Tx, staff: StaffCredentials, attempt: MfaAttempt): Promise<boolean> {
  if (attempt.method === "totp") {
    const step = matchingStep(staff, attempt.input, attempt.now);
    return step !== null && (await acceptTotpStep(tx, staff.id, step));
  }
  const code = normalizeRecoveryCode(attempt.input);
  return (
    code !== null &&
    (await consumeRecoveryCode(tx, { staff, codeHash: recoveryCodeHash(code), at: attempt.now }))
  );
}

/** رمز جديد للجلسة يحمل إثبات الخطوة الثانية؛ الجلسة القديمة تُلغى والحد المطلق يُورَّث. */
async function rotateVerified(tx: Tx, context: StaffContext, now: Date): Promise<MfaResult> {
  const issued = issueSessionToken();
  const rotated = await rotateStaffSession(tx, {
    sessionId: context.session.id,
    tokenHash: issued.tokenHash,
    now,
    mfaVerifiedAt: now,
  });
  return rotated === null ? null : { token: issued.token, expiresAt: context.session.expiresAt };
}

/**
 * إثبات الخطوة الثانية لجلسة دخلت بكلمة المرور (docs/ADMIN_DESIGN.md §4.4–4.6). الفشل يُعدّ في عدّاد
 * قفل الحساب نفسه، فخمس محاولات خاطئة متتالية تقفل 15 دقيقة مهما أُعيد تشغيل الخادم.
 */
export async function verifySecondStep(attempt: MfaAttempt): Promise<MfaResult> {
  const staff = await credentialsOf(attempt.context);
  const allowed = allowMfaAttempt(attempt.meta.ip, staff.id) && !isLockedOut(staff, attempt.now);
  if (!allowed) {
    return null;
  }
  const result = await inTransaction(getDb(), async (tx) => {
    if (!(await consume(tx, staff, attempt))) {
      return ok(null);
    }
    await recordMfaVerified(tx, {
      staff,
      method: attempt.method,
      ip: attempt.meta.ip,
      at: attempt.now,
    });
    return ok(await rotateVerified(tx, attempt.context, attempt.now));
  });
  const session = result.ok ? result.value : null;
  if (session === null) {
    await recordFailedAttempt(getDb(), {
      staffId: staff.id,
      clubId: staff.clubId,
      ip: attempt.meta.ip,
      at: attempt.now,
      credential: attempt.method,
    });
  }
  return session;
}

export interface EnrolmentSetup {
  /** المفتاح نصًا (Base32) لمن لا يستطيع مسح الرمز. */
  readonly secretBase32: string;
  /** الرابط الذي يحمله رمز QR. */
  readonly uri: string;
}

/**
 * سر التسجيل المعلّق لحساب لم يفعّل الخطوة الثانية: يُنشأ مرة ويُحفظ مشفّرًا، ويُعاد هو نفسه عند
 * تحديث الصفحة حتى لا يبطل رمز مُسح للتو. سر لا يُفك (مفتاح تغيّر) يُستبدل بجديد.
 */
export async function enrolmentSetup(context: StaffContext): Promise<EnrolmentSetup> {
  const staff = await credentialsOf(context);
  let secret = totpKey(staff);
  if (secret === null) {
    secret = newTotpSecret();
    await savePendingTotpSecret(getDb(), staff.id, sealSecret(adminSecretKey(), secret, staff.id));
  }
  const secretBase32 = base32Encode(secret);
  return {
    secretBase32,
    uri: otpauthUri({ issuer: TOTP_ISSUER, account: staff.email, secretBase32 }),
  };
}

export interface EnrolmentDone extends IssuedSession {
  /** تُعرض مرة واحدة ولا تُحفظ إلا مجزأة. */
  readonly recoveryCodes: readonly string[];
}

/**
 * تأكيد التسجيل برمز من التطبيق: يفعّل الخطوة الثانية، ويصدر عشرة رموز استرجاع، ويدوّر رمز الجلسة
 * حاملًا إثبات الخطوة الثانية. null لرمز خاطئ أو حد محاولات.
 */
export async function confirmEnrolment(
  attempt: Omit<MfaAttempt, "method">,
): Promise<EnrolmentDone | null> {
  const staff = await credentialsOf(attempt.context);
  const step = allowMfaAttempt(attempt.meta.ip, staff.id)
    ? matchingStep(staff, attempt.input, attempt.now)
    : null;
  if (step === null) {
    return null;
  }
  const recovery = issueRecoveryCodes();
  const result = await inTransaction(getDb(), async (tx) => {
    await completeTotpEnrolment(tx, {
      staff,
      step,
      recoveryCodeHashes: recovery.hashes,
      at: attempt.now,
    });
    return ok(await rotateVerified(tx, attempt.context, attempt.now));
  });
  const session = result.ok ? result.value : null;
  return session === null ? null : { ...session, recoveryCodes: recovery.codes };
}
