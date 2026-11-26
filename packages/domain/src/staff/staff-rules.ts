import { DomainError } from "../errors";
import { err, ok, type Result } from "../result";
import type { StaffRole, StaffStatus } from "./roles";

/** قواعد حساب الموظف التي لا تحتاج قاعدة بيانات: شكل البريد والاسم، وبقاء مالك نشط. */
export const STAFF_EMAIL_MAX_LENGTH = 254;
export const STAFF_NAME_MIN_LENGTH = 2;
export const STAFF_NAME_MAX_LENGTH = 80;

/** شكل عملي لا تحقق من وجود الصندوق: جزء محلي، @، نطاق بنقطة. يطابقه قيد القاعدة. */
const EMAIL_SHAPE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/** البريد صغير الحروف دائمًا: الفرادة بلا حساسية حروف. */
export function parseStaffEmail(raw: string): Result<string, DomainError> {
  const email = raw.trim().toLowerCase();
  if (email.length > STAFF_EMAIL_MAX_LENGTH || !EMAIL_SHAPE.test(email)) {
    return err(new DomainError("validation", "staff.email_invalid", { field: "email" }));
  }
  return ok(email);
}

export function parseStaffName(raw: string): Result<string, DomainError> {
  const name = raw.trim().replace(/\s+/g, " ");
  const length = Array.from(name).length;
  if (length < STAFF_NAME_MIN_LENGTH || length > STAFF_NAME_MAX_LENGTH) {
    return err(new DomainError("validation", "staff.name_invalid", { field: "displayName" }));
  }
  return ok(name);
}

export interface StaffStanding {
  readonly role: StaffRole;
  readonly status: StaffStatus;
}

function isActiveOwner(standing: StaffStanding): boolean {
  return standing.role === "owner" && standing.status === "active";
}

/**
 * هل يترك هذا التغيير النادي بلا مالك نشط؟ `activeOwners` عدد المالكين النشطين قبل التغيير.
 * القاعدة تفرض الشيء نفسه بمحفّز (`staff_last_owner_required`) سدًّا أخيرًا للسباق.
 */
export function removesLastOwner(
  current: StaffStanding,
  next: StaffStanding,
  activeOwners: number,
): boolean {
  return isActiveOwner(current) && !isActiveOwner(next) && activeOwners <= 1;
}

export function assertOwnerRemains(
  current: StaffStanding,
  next: StaffStanding,
  activeOwners: number,
): Result<StaffStanding, DomainError> {
  if (removesLastOwner(current, next, activeOwners)) {
    return err(new DomainError("conflict", "staff.last_owner"));
  }
  return ok(next);
}

export interface ClubNames {
  readonly slug: string;
  readonly nameAr: string;
  readonly nameEn: string;
}

/**
 * ما لا تحويه كلمة مرور موظف من اسم النادي: الاسم كاملًا بلغتيه ومعرّفه، وكل كلمة منها. الكلمات
 * الأقصر من حدّ السياسة تُهمل هناك (`checkPasswordPolicy`).
 */
export function clubPasswordWords(club: ClubNames): string[] {
  const names = [club.nameAr, club.nameEn, club.slug.replaceAll("-", " ")];
  const tokens = names.flatMap((name) => name.split(/\s+/));
  return [...new Set([...names, ...tokens].filter((word) => word !== ""))];
}
