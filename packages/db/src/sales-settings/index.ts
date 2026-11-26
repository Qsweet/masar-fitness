/**
 * إعدادات البيع للمالك (ADMIN_A2_SALES §9): مهلة الطلب وقاعدة بدء الاشتراك في صف النادي. تسري على
 * الطلبات الجديدة فقط: كل طلب قائم مختوم بمهلته (`expires_at`) وقاعدته (سطر الاشتراك). NULL = لم
 * يحسمها المالك، فيبقى إنشاء الطلب ممنوعًا كما هو (القرار 32)؛ لا قيمة بديلة هنا.
 */
import {
  DomainError,
  err,
  ok,
  type MembershipStartRule,
  type Result,
  type SalesSettings,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { inTransaction, type Tx } from "../commerce/transaction";

export const SALES_SETTINGS_AUDIT_ACTION = "sales_settings_updated";

export interface SalesSettingsView extends SalesSettings {
  /** قراءة فقط: تغيير الضريبة قرار نظامي له أثر محاسبي، لا حقل. */
  readonly vatRateBps: number;
  readonly currency: string;
  readonly timezone: string;
  readonly lockToken: string;
}

interface ClubRow {
  readonly order_payment_window_minutes: number | null;
  readonly membership_start_rule: MembershipStartRule | null;
  readonly updated_at: Date;
}

function lockToken(updatedAt: Date): string {
  return String(updatedAt.getTime());
}

export async function getSalesSettings(db: Db, clubId: string): Promise<SalesSettingsView> {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
  return {
    orderPaymentWindowMinutes: club.orderPaymentWindowMinutes,
    membershipStartRule: club.membershipStartRule,
    vatRateBps: club.vatRateBps,
    currency: club.currency,
    timezone: club.timezone,
    lockToken: lockToken(club.updatedAt),
  };
}

export interface UpdateSalesSettingsInput {
  readonly clubId: string;
  readonly lockToken: string;
  readonly settings: SalesSettings;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface UpdatedSalesSettings {
  /** لا فرق عن المحفوظ: لا كتابة ولا سطر تدقيق. */
  readonly changed: boolean;
}

async function updateInTransaction(
  tx: Tx,
  input: UpdateSalesSettingsInput,
): Promise<Result<UpdatedSalesSettings, DomainError>> {
  const rows = await tx.$queryRaw<ClubRow[]>`
    SELECT order_payment_window_minutes, membership_start_rule, updated_at
    FROM clubs WHERE id = ${input.clubId}::uuid FOR UPDATE`;
  const club = rows[0];
  if (club === undefined) {
    return err(new DomainError("not_found", "club.not_found"));
  }
  if (lockToken(club.updated_at) !== input.lockToken) {
    return err(new DomainError("conflict", "sales_settings.stale_edit"));
  }
  const { orderPaymentWindowMinutes: window, membershipStartRule: rule } = input.settings;
  if (window === club.order_payment_window_minutes && rule === club.membership_start_rule) {
    return ok({ changed: false });
  }
  const updatedAt = new Date(Math.max(input.now.getTime(), club.updated_at.getTime() + 1));
  await tx.$executeRaw`
    UPDATE clubs SET order_payment_window_minutes = ${window},
      membership_start_rule = ${rule}::membership_start_rule, updated_at = ${updatedAt}
    WHERE id = ${input.clubId}::uuid`;
  await writeAudit(tx, {
    clubId: input.clubId,
    entityType: "club",
    entityId: input.clubId,
    action: SALES_SETTINGS_AUDIT_ACTION,
    fromState: null,
    toState: null,
    actor: input.actor,
    data: {
      windowBefore: club.order_payment_window_minutes,
      windowAfter: window,
      startRuleBefore: club.membership_start_rule,
      startRuleAfter: rule,
    },
    at: input.now,
  });
  return ok({ changed: true });
}

/** يحفظ القيمتين مع سطر تدقيق بالقديم والجديد. رمز قفل قديم ⇒ `sales_settings.stale_edit`. */
export function updateSalesSettings(
  db: Db,
  input: UpdateSalesSettingsInput,
): Promise<Result<UpdatedSalesSettings, DomainError>> {
  return inTransaction(db, (tx) => updateInTransaction(tx, input));
}
