/**
 * حارس العرض التلقائي (مراجعة A2): عرض بلا رمز يجعل منتجًا يُباع مجانيًا يُسقط البيع كله، فلا يُحفظ
 * ولا يُفعَّل. المنتجات تُقرأ بسعرها الساري لحظة الكتابة، وقاعدة «يُباع» هي `isSellable` الواحدة.
 */
import {
  DomainError,
  automaticZeroedProducts,
  err,
  isSellable,
  money,
  ok,
  type AutomaticTerms,
  type LocalizedText,
  type Result,
  type SellablePrice,
} from "@masar/domain";
import type { Db } from "../client";
import { versionsAt } from "../commerce/load-catalog";
import type { Tx } from "../commerce/transaction";

export const AUTOMATIC_ZEROES_SALE = "promotion.automatic_zeroes_sale";

async function sellablePrices(
  client: Pick<Db | Tx, "product">,
  clubId: string,
  now: Date,
): Promise<SellablePrice[]> {
  const rows = await client.product.findMany({
    where: { clubId, status: "active" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      kind: true,
      status: true,
      nameAr: true,
      nameEn: true,
      versions: versionsAt(now),
    },
  });
  return rows.flatMap((row) => {
    const version = row.versions[0] ?? null;
    const sellable = isSellable({ status: row.status, kind: row.kind, currentVersion: version });
    return version === null || !sellable
      ? []
      : [
          {
            id: row.id,
            name: { ar: row.nameAr, en: row.nameEn },
            price: money(version.priceMinor, version.currency),
          },
        ];
  });
}

/** أسماء المنتجات التي يجعلها العرض مجانية الآن: لصفحة التأكيد ولتسمية الباقة في رسالة الرفض. */
export async function automaticZeroedNames(
  client: Pick<Db | Tx, "product">,
  clubId: string,
  terms: AutomaticTerms,
  now: Date,
): Promise<readonly LocalizedText[]> {
  if (terms.code !== null) {
    return [];
  }
  const zeroed = automaticZeroedProducts(terms, await sellablePrices(client, clubId, now));
  return zeroed.map((product) => product.name);
}

/**
 * يرفض حفظ العرض التلقائي أو تفعيله إن جعل منتجًا يُباع مجانيًا. يُستدعى تحت قفل العرض. عند الحفظ
 * يظهر الخطأ بجانب حقل الخصم؛ عند التفعيل على مستوى النموذج.
 */
export async function checkAutomaticTerms(
  tx: Tx,
  check: { readonly clubId: string; readonly terms: AutomaticTerms; readonly now: Date },
  atField: boolean,
): Promise<Result<void, DomainError>> {
  const { clubId, terms, now } = check;
  const zeroed = await automaticZeroedNames(tx, clubId, terms, now);
  if (zeroed.length === 0) {
    return ok(undefined);
  }
  const field = terms.discount.kind === "percentage" ? "percent" : "amount";
  return err(new DomainError("conflict", AUTOMATIC_ZEROES_SALE, atField ? { field } : {}));
}
