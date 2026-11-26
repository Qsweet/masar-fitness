import "server-only";
import {
  findCustomerIdByPhone,
  revealCustomerPhone,
  staffActor,
  type PhoneRevealTarget,
} from "@masar/db";
import { DomainError, err, ok, parseSaudiMobile, type Result } from "@masar/domain";
import { getDb } from "../../db";
import { logger } from "../../logger";
import type { StaffContext } from "../session";
import { allowPhoneLookup, allowPhoneReveal } from "../throttle";

/**
 * بحث العميل بالجوال الكامل وكشفه (ADMIN_A2_SALES §6.3). الرقم يصل في جسم POST ولا يُكتب في رابط
 * ولا سجل: ما يُسجَّل معرّف الموظف وحده. رسالة واحدة لما لا يوجد.
 */
export async function lookupCustomer(
  context: StaffContext,
  rawMobile: string,
): Promise<Result<string, DomainError>> {
  if (!allowPhoneLookup(context.staff.id)) {
    logger.warn("admin.phone_lookup_throttled", { staffId: context.staff.id });
    return err(new DomainError("forbidden", "customers.too_many_lookups"));
  }
  const mobile = parseSaudiMobile(rawMobile);
  if (!mobile.ok) {
    return err(new DomainError("validation", "customers.mobile_invalid", { field: "mobile" }));
  }
  const id = await findCustomerIdByPhone(getDb(), context.staff.clubId, mobile.value);
  return id === undefined ? err(new DomainError("not_found", "customer.not_found")) : ok(id);
}

/**
 * يكشف الجوال الكامل: سطر التدقيق يُكتب في المعاملة نفسها، وبلا سطر لا رقم. الرفض بالحد يُسجَّل في
 * السجل المنظَّم (بلا رقم).
 */
export async function revealPhone(
  context: StaffContext,
  target: PhoneRevealTarget,
  now: Date,
): Promise<Result<string, DomainError>> {
  if (!allowPhoneReveal(context.staff.id)) {
    logger.warn("admin.phone_reveal_throttled", {
      staffId: context.staff.id,
      source: target.source,
    });
    return err(new DomainError("forbidden", "customers.too_many_reveals"));
  }
  const revealed = await revealCustomerPhone(getDb(), {
    clubId: context.staff.clubId,
    target,
    actor: staffActor(context.staff.id),
    now,
  });
  return revealed.ok ? ok(revealed.value.phoneE164) : revealed;
}
