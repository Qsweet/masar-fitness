import { CURRENCIES, DomainError, basisPoints, type CommercePolicy } from "@masar/domain";
import type { Tx } from "./transaction";

/**
 * سياسة البيع كما في صف النادي. القيم الفارغة تبقى null فتمنع العملية في المجال،
 * ولا قيمة بديلة لها هنا.
 */
export async function loadCommercePolicy(client: Tx, clubId: string): Promise<CommercePolicy> {
  const club = await client.club.findUniqueOrThrow({
    where: { id: clubId },
    select: {
      vatRateBps: true,
      currency: true,
      timezone: true,
      orderPaymentWindowMinutes: true,
      membershipStartRule: true,
    },
  });
  const currency = CURRENCIES.find((supported) => supported === club.currency);
  if (currency === undefined) {
    throw new DomainError("invariant", "club.unsupported_currency");
  }
  return {
    vatRate: basisPoints(club.vatRateBps),
    currency,
    timeZone: club.timezone,
    orderPaymentWindowMinutes: club.orderPaymentWindowMinutes,
    membershipStartRule: club.membershipStartRule,
  };
}
