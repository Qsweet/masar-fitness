/**
 * أوامر الخادم لحساب المالك (ADMIN_DESIGN §4.1 و§4.4 و§4.12): إنشاء أول مالك، وإعادة ضبط خطوته
 * الثانية، وكلمة مروره. المنطق هنا بطرفية محقونة ليُختبر؛ السكربتات في `scripts/admin` تربطه
 * بلوحة المفاتيح فقط. لا شيء يُقرأ من وسائط الأمر ولا من متغيرات البيئة.
 */
import {
  checkPasswordPolicy,
  clubPasswordWords,
  ok,
  parseStaffEmail,
  parseStaffName,
  type DomainError,
  type Result,
} from "@masar/domain";
import type { Db } from "../../client";
import { inTransaction } from "../../commerce/transaction";
import { countActiveOwners, findStaffCredentialsByEmail, type StaffAccount } from "../accounts";
import { hashPassword } from "../crypto";
import { createFirstOwner, setStaffPassword } from "../manage";
import { resetTotp } from "../mfa";
import { listClubs } from "../overview";
import { MESSAGES } from "./messages";

/** طرفية الأمر: سؤال ظاهر، وسؤال مخفي الإدخال لكلمة المرور، وسطر إخراج. */
export interface Terminal {
  ask(question: string): Promise<string>;
  askHidden(question: string): Promise<string>;
  print(line: string): void;
}

/** محاولات تصحيح كل إدخال قبل إنهاء الأمر. */
const MAX_INPUT_ATTEMPTS = 3;
/** ما يكتبه المالك حرفيًا لتأكيد إعادة الضبط. */
export const RESET_CONFIRMATION = "RESET";

type Club = Awaited<ReturnType<typeof listClubs>>[number];

async function askUntilValid<T>(
  terminal: Terminal,
  question: string,
  parse: (raw: string) => Result<T, DomainError>,
): Promise<T | null> {
  for (let attempt = 0; attempt < MAX_INPUT_ATTEMPTS; attempt += 1) {
    const parsed = parse(await terminal.ask(question));
    if (parsed.ok) {
      return parsed.value;
    }
    terminal.print(MESSAGES.reasons[parsed.error.reason] ?? MESSAGES.invalidInput);
  }
  terminal.print(MESSAGES.tooManyAttempts);
  return null;
}

async function chooseClub(db: Db, terminal: Terminal): Promise<Club | null> {
  const clubs = await listClubs(db);
  const [only] = clubs;
  if (only === undefined) {
    terminal.print(MESSAGES.noClub);
    return null;
  }
  if (clubs.length === 1) {
    return only;
  }
  terminal.print(`${MESSAGES.clubChoices} ${clubs.map((club) => club.slug).join(", ")}`);
  const slug = (await terminal.ask(MESSAGES.askClub)).trim();
  const chosen = clubs.find((club) => club.slug === slug);
  if (chosen === undefined) {
    terminal.print(MESSAGES.unknownClub);
    return null;
  }
  return chosen;
}

/** يسأل عن كلمة مرور جديدة مرتين (مخفية) حتى تطابق السياسة؛ يرجع تجزئتها، أو null بعد المحاولات. */
async function askNewPasswordHash(
  terminal: Terminal,
  email: string,
  club: Club,
): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_INPUT_ATTEMPTS; attempt += 1) {
    const password = await terminal.askHidden(MESSAGES.askPassword);
    const checked = checkPasswordPolicy({
      password,
      email,
      forbiddenWords: clubPasswordWords(club),
    });
    if (!checked.ok) {
      terminal.print(MESSAGES.reasons[checked.error.reason] ?? MESSAGES.invalidInput);
      continue;
    }
    if ((await terminal.askHidden(MESSAGES.askPasswordAgain)) !== password) {
      terminal.print(MESSAGES.passwordMismatch);
      continue;
    }
    return hashPassword(checked.value);
  }
  terminal.print(MESSAGES.tooManyAttempts);
  return null;
}

/** `pnpm admin:create-owner`: يرفض إن وُجد مالك نشط. يرجع هل أُنشئ المالك. */
export async function runCreateOwner(db: Db, terminal: Terminal, now: Date): Promise<boolean> {
  const club = await chooseClub(db, terminal);
  if (club === null) {
    return false;
  }
  if ((await countActiveOwners(db, club.id)) > 0) {
    terminal.print(MESSAGES.ownerExists);
    return false;
  }
  const email = await askUntilValid(terminal, MESSAGES.askEmail, parseStaffEmail);
  const displayName =
    email === null ? null : await askUntilValid(terminal, MESSAGES.askName, parseStaffName);
  if (email === null || displayName === null) {
    return false;
  }
  const passwordHash = await askNewPasswordHash(terminal, email, club);
  if (passwordHash === null) {
    return false;
  }
  const created = await createFirstOwner(db, {
    clubId: club.id,
    email,
    displayName,
    passwordHash,
    at: now,
  });
  terminal.print(
    created.ok
      ? MESSAGES.ownerCreated
      : (MESSAGES.reasons[created.error.reason] ?? MESSAGES.invalidInput),
  );
  return created.ok;
}

/** المالك النشط صاحب هذا البريد، أو null برسالة واحدة لا تفرّق بين «غير موجود» و«ليس مالكًا». */
async function askActiveOwner(db: Db, terminal: Terminal): Promise<StaffAccount | null> {
  const email = await askUntilValid(terminal, MESSAGES.askEmail, parseStaffEmail);
  const staff = email === null ? null : await findStaffCredentialsByEmail(db, email);
  if (staff?.role !== "owner" || staff.status !== "active") {
    terminal.print(MESSAGES.ownerNotFound);
    return null;
  }
  return staff;
}

/** `pnpm admin:reset-owner-mfa`: يمحو الخطوة الثانية للمالك بعد تأكيد حرفي، فيسجّلها من جديد. */
export async function runResetOwnerMfa(db: Db, terminal: Terminal, now: Date): Promise<boolean> {
  const owner = await askActiveOwner(db, terminal);
  if (owner === null) {
    return false;
  }
  if ((await terminal.ask(MESSAGES.confirmReset)).trim() !== RESET_CONFIRMATION) {
    terminal.print(MESSAGES.cancelled);
    return false;
  }
  await inTransaction(db, async (tx) => {
    await resetTotp(tx, { staff: owner, actor: "system", at: now });
    return ok(null);
  });
  terminal.print(MESSAGES.mfaReset);
  return true;
}

/** `pnpm admin:reset-owner-password`: كلمة مرور جديدة للمالك من لوحة مفاتيح الخادم، وتُلغى جلساته. */
export async function runResetOwnerPassword(
  db: Db,
  terminal: Terminal,
  now: Date,
): Promise<boolean> {
  const owner = await askActiveOwner(db, terminal);
  const clubs = owner === null ? [] : await listClubs(db);
  const club = clubs.find((candidate) => candidate.id === owner?.clubId);
  if (owner === null || club === undefined) {
    return false;
  }
  const passwordHash = await askNewPasswordHash(terminal, owner.email, club);
  if (passwordHash === null) {
    return false;
  }
  await inTransaction(db, async (tx) => {
    await setStaffPassword(tx, {
      clubId: owner.clubId,
      staffId: owner.id,
      passwordHash,
      action: "password_reset",
      mustChangePassword: false,
      actor: "system",
      at: now,
    });
    return ok(null);
  });
  terminal.print(MESSAGES.passwordReset);
  return true;
}
