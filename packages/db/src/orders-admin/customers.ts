/**
 * العملاء في اللوحة (ADMIN_A2_SALES §6.3 و§7): بحث بالجوال الكامل مطابقةً تامة، وصفحة قراءة دنيا،
 * وكشف الجوال المدقَّق. الجوال الكامل لا يخرج من `packages/db` إلا من `revealCustomerPhone`، وكل
 * خروج له يكتب سطر تدقيق في المعاملة نفسها.
 */
import {
  DomainError,
  effectiveMembershipStatus,
  err,
  maskSaudiMobile,
  ok,
  plainDateInZone,
  type LocalizedText,
  type MembershipStatus,
  type PlainDate,
  type Result,
  type SaudiMobile,
} from "@masar/domain";
import type { Db } from "../client";
import { writeAudit, type StaffAuditActor } from "../commerce/audit";
import { plainDateFromColumn } from "../commerce/load-customer";
import { inTransaction, type Tx } from "../commerce/transaction";
import { ADMIN_VISIBLE_PHONE_DIGITS } from "./list-orders";

/**
 * معرّف العميل صاحب هذا الجوال في النادي، أو undefined. مطابقة تامة على الفهرس الفريد
 * `(club_id, phone_e164)`: لا مطابقة جزئية ولا بحث بآخر الأرقام.
 */
export async function findCustomerIdByPhone(
  db: Db,
  clubId: string,
  phone: SaudiMobile,
): Promise<string | undefined> {
  const customer = await db.customer.findUnique({
    where: { clubId_phoneE164: { clubId, phoneE164: phone } },
    select: { id: true },
  });
  return customer?.id;
}

export interface CustomerMembershipView {
  readonly id: string;
  readonly orderId: string;
  /** الحالة كما تُعرض: النشط الذي بلغ نهايته منتهٍ. */
  readonly status: MembershipStatus;
  readonly paidMonths: number;
  readonly bonusMonths: number;
  readonly startsOn: PlainDate | null;
  readonly endsOn: PlainDate | null;
}

export interface CustomerAssessmentView {
  readonly id: string;
  readonly service: LocalizedText;
  readonly createdAt: Date;
}

export interface CustomerDetail {
  readonly id: string;
  /** آخر أربعة أرقام فقط ظاهرة. */
  readonly maskedPhone: string;
  readonly createdAt: Date;
  readonly firstOrderAt: Date | null;
  readonly timeZone: string;
  readonly memberships: readonly CustomerMembershipView[];
  readonly assessments: readonly CustomerAssessmentView[];
}

function loadCustomer(db: Db, clubId: string, customerId: string) {
  return db.customer.findFirst({
    where: { id: customerId, clubId },
    include: {
      club: { select: { timezone: true } },
      memberships: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
      assessmentRequests: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { product: { select: { nameAr: true, nameEn: true } } },
      },
      orders: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
    },
  });
}

type CustomerRow = NonNullable<Awaited<ReturnType<typeof loadCustomer>>>;

function toMembership(
  row: CustomerRow["memberships"][number],
  today: PlainDate,
): CustomerMembershipView {
  const endsOn = row.endsOn === null ? null : plainDateFromColumn(row.endsOn);
  return {
    id: row.id,
    orderId: row.orderId,
    status: effectiveMembershipStatus(row.status, endsOn, today),
    paidMonths: row.paidMonths,
    bonusMonths: row.bonusMonths,
    startsOn: row.startsOn === null ? null : plainDateFromColumn(row.startsOn),
    endsOn,
  };
}

/** صفحة العميل: بلا اسم (الأسماء لقطات على طلباته) وبجوال مقنَّع. طلباته تُقرأ بـ`listOrders`. */
export async function getCustomerDetail(
  db: Db,
  clubId: string,
  customerId: string,
  now: Date,
): Promise<CustomerDetail | undefined> {
  const row = await loadCustomer(db, clubId, customerId);
  if (row === null) {
    return undefined;
  }
  const today = plainDateInZone(now, row.club.timezone);
  return {
    id: row.id,
    maskedPhone: maskSaudiMobile(row.phoneE164, ADMIN_VISIBLE_PHONE_DIGITS),
    createdAt: row.createdAt,
    firstOrderAt: row.orders[0]?.createdAt ?? null,
    timeZone: row.club.timezone,
    memberships: row.memberships.map((membership) => toMembership(membership, today)),
    assessments: row.assessmentRequests.map((request) => ({
      id: request.id,
      service: { ar: request.product.nameAr, en: request.product.nameEn },
      createdAt: request.createdAt,
    })),
  };
}

/** من أين طُلب الكشف: تفصيل طلب (جوال لقطته) أو صفحة العميل. */
export type PhoneRevealTarget =
  | { readonly source: "order"; readonly orderId: string }
  | { readonly source: "customer"; readonly customerId: string };

export interface RevealPhoneInput {
  readonly clubId: string;
  readonly target: PhoneRevealTarget;
  readonly actor: StaffAuditActor;
  readonly now: Date;
}

export interface RevealedPhone {
  readonly customerId: string;
  readonly phoneE164: string;
}

async function readPhone(tx: Tx, input: RevealPhoneInput): Promise<RevealedPhone | undefined> {
  const { target, clubId } = input;
  if (target.source === "order") {
    const order = await tx.order.findFirst({
      where: { id: target.orderId, clubId },
      select: { customerId: true, customerPhoneE164: true },
    });
    return order === null
      ? undefined
      : { customerId: order.customerId, phoneE164: order.customerPhoneE164 };
  }
  const customer = await tx.customer.findFirst({
    where: { id: target.customerId, clubId },
    select: { id: true, phoneE164: true },
  });
  return customer === null ? undefined : { customerId: customer.id, phoneE164: customer.phoneE164 };
}

/**
 * يكشف الجوال الكامل ويكتب سطر تدقيقه في المعاملة نفسها: إن لم يُكتب السطر لا يرجع الرقم. السطر يحمل
 * مصدر الكشف ومعرّف الطلب، ولا يحمل الرقم ولا مفتاحًا باسمه.
 */
export async function revealCustomerPhone(
  db: Db,
  input: RevealPhoneInput,
): Promise<Result<RevealedPhone, DomainError>> {
  return inTransaction(db, async (tx) => {
    const revealed = await readPhone(tx, input);
    if (revealed === undefined) {
      return err(new DomainError("not_found", "customer.not_found"));
    }
    await writeAudit(tx, {
      clubId: input.clubId,
      entityType: "customer",
      entityId: revealed.customerId,
      action: "phone_revealed",
      fromState: null,
      toState: null,
      actor: input.actor,
      data: {
        source: input.target.source,
        orderId: input.target.source === "order" ? input.target.orderId : null,
      },
      at: input.now,
    });
    return ok(revealed);
  });
}
