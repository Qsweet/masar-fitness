/**
 * سطور السلة من الكتالوج: المنتج بـslug ونسخته السارية الآن. المزايا تُقرأ منفصلة بعد قفل النسخ،
 * فلا تُختم في الطلب مزايا تغيّرت بين القراءة والقفل.
 */
import {
  DomainError,
  err,
  money,
  ok,
  type CartLine,
  type LocalizedText,
  type PurchasableKind,
  type Result,
} from "@masar/domain";
import type { Prisma } from "../generated/prisma/client";
import type { Tx } from "./transaction";

/** سطر السلة قبل قراءة مزاياه. */
export type CatalogLine = Omit<CartLine, "benefits">;

export interface CatalogCart {
  readonly clubId: string;
  readonly primary: CatalogLine;
  readonly addons: readonly CatalogLine[];
  readonly attachableAddonProductIds: readonly string[];
}

export interface CartRequest {
  readonly planSlug: string;
  readonly addonSlugs: readonly string[];
  readonly now: Date;
}

/** النسخة السارية لحظة `now`؛ مشتركة بين السلة وقائمة الإضافات. */
export function versionsAt(now: Date) {
  return {
    where: {
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    // قيد القاعدة يمنع تداخل النسخ، فالسارية واحدة على الأكثر؛ الترتيب يبقى حتميًا احتياطًا
    orderBy: [{ validFrom: "desc" }, { id: "desc" }],
    take: 1,
    select: { id: true, priceMinor: true, currency: true, durationMonths: true, bonusMonths: true },
  } satisfies Prisma.Product$versionsArgs;
}

type ProductRow = Awaited<ReturnType<typeof findProducts>>[number];

function findProducts(client: Tx, slugs: readonly string[], now: Date) {
  return client.product.findMany({
    where: { slug: { in: [...slugs] } },
    select: {
      id: true,
      clubId: true,
      kind: true,
      slug: true,
      status: true,
      nameAr: true,
      nameEn: true,
      summaryAr: true,
      summaryEn: true,
      sortOrder: true,
      versions: versionsAt(now),
    },
  });
}

function unavailable(): DomainError {
  return new DomainError("not_found", "cart.product_unavailable");
}

/** المنتج قابل للبيع: فعّال، وله نسخة سارية، ونوعه يُشترى مباشرة، والاشتراك له مدة. */
function toLine(row: ProductRow | undefined, sortOrder?: number): CatalogLine | undefined {
  const version = row?.versions[0];
  if (row?.status !== "active" || version === undefined || row.kind === "assessed_service") {
    return undefined;
  }
  const kind: PurchasableKind = row.kind;
  if (kind === "membership" && version.durationMonths === null) {
    return undefined;
  }
  return {
    productId: row.id,
    versionId: version.id,
    kind,
    slug: row.slug,
    name: { ar: row.nameAr, en: row.nameEn },
    summary: { ar: row.summaryAr, en: row.summaryEn },
    listPrice: money(version.priceMinor, version.currency),
    paidMonths: version.durationMonths,
    bonusMonths: version.bonusMonths,
    sortOrder: sortOrder ?? row.sortOrder,
  };
}

/** كل إضافة مطلوبة منتج من نوع addon قابل للبيع في نادي الباقة؛ الربط تفحصه `validateCart`. */
function toAddonLines(
  rows: readonly ProductRow[],
  request: CartRequest,
  clubId: string,
  links: ReadonlyMap<string, number>,
): CatalogLine[] | undefined {
  const lines: CatalogLine[] = [];
  for (const slug of request.addonSlugs) {
    const row = rows.find((candidate) => candidate.slug === slug);
    const line = toLine(row, row === undefined ? undefined : links.get(row.id));
    if (row?.clubId !== clubId || line?.kind !== "addon") {
      return undefined;
    }
    lines.push(line);
  }
  return lines;
}

/** الإضافات المرتبطة بالباقة وترتيب عرضها معها. */
async function loadAddonLinks(
  client: Tx,
  membershipProductId: string,
): Promise<Map<string, number>> {
  const links = await client.productAddon.findMany({
    where: { membershipProductId },
    select: { addonProductId: true, sortOrder: true },
  });
  return new Map(links.map((link) => [link.addonProductId, link.sortOrder]));
}

/** يقرأ السلة من الكتالوج. أي منتج غير قابل للبيع ⇒ `cart.product_unavailable`. */
export async function loadCartLines(
  client: Tx,
  request: CartRequest,
): Promise<Result<CatalogCart, DomainError>> {
  const rows = await findProducts(client, [request.planSlug, ...request.addonSlugs], request.now);
  const primaryRow = rows.find((row) => row.slug === request.planSlug);
  const primary = toLine(primaryRow);
  if (primaryRow === undefined || primary === undefined) {
    return err(unavailable());
  }
  const links = await loadAddonLinks(client, primary.productId);
  const addons = toAddonLines(rows, request, primaryRow.clubId, links);
  if (addons === undefined) {
    return err(unavailable());
  }
  return ok({
    clubId: primaryRow.clubId,
    primary,
    addons,
    attachableAddonProductIds: [...links.keys()],
  });
}

/** معرّفات نسخ السلة كلها، مرتبة بلا تكرار (ترتيب القفل). */
export function cartVersionIds(cart: CatalogCart): string[] {
  const ids = [cart.primary, ...cart.addons].map((line) => line.versionId);
  return [...new Set(ids)].sort();
}

/** مزايا النسخ بترتيب العرض. تُستدعى بعد قفل النسخ في الإنشاء. */
export async function loadBenefits(
  client: Tx,
  versionIds: readonly string[],
): Promise<Map<string, LocalizedText[]>> {
  const rows = await client.productBenefit.findMany({
    where: { versionId: { in: [...versionIds] } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { versionId: true, labelAr: true, labelEn: true },
  });
  const benefits = new Map<string, LocalizedText[]>(versionIds.map((id) => [id, []]));
  for (const row of rows) {
    benefits.get(row.versionId)?.push({ ar: row.labelAr, en: row.labelEn });
  }
  return benefits;
}

/** سطور السلة الكاملة بمزاياها. */
export function withBenefits(
  cart: CatalogCart,
  benefits: ReadonlyMap<string, readonly LocalizedText[]>,
): { primary: CartLine; addons: CartLine[] } {
  const complete = (line: CatalogLine): CartLine => ({
    ...line,
    benefits: benefits.get(line.versionId) ?? [],
  });
  return { primary: complete(cart.primary), addons: cart.addons.map(complete) };
}
