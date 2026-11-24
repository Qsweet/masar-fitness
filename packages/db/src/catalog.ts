import { money, type MembershipPlan } from "@masar/domain";
import type { Db } from "./client";
import type { Prisma } from "./generated/prisma/client";

/** شكل الاستعلام: المنتج مع نسخته السارية الأحدث ومزاياها. */
function currentVersionQuery(now: Date) {
  return {
    where: {
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    orderBy: { validFrom: "desc" },
    take: 1,
    include: { benefits: { orderBy: { sortOrder: "asc" } } },
  } satisfies Prisma.Product$versionsArgs;
}

type ProductRow = Awaited<ReturnType<typeof findMembershipRows>>[number];

function findMembershipRows(db: Db, now: Date, slug?: string) {
  return db.product.findMany({
    where: { kind: "membership", status: "active", ...(slug === undefined ? {} : { slug }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { versions: currentVersionQuery(now) },
  });
}

/** منتج بلا نسخة سارية أو بلا مدة ليس معروضًا للبيع: لا يظهر. */
function toPlan(row: ProductRow): MembershipPlan | undefined {
  const version = row.versions[0];
  if (version === undefined || version.durationMonths === null) {
    return undefined;
  }
  return {
    slug: row.slug,
    name: { ar: row.nameAr, en: row.nameEn },
    summary: { ar: row.summaryAr, en: row.summaryEn },
    price: money(version.priceMinor, version.currency),
    paidMonths: version.durationMonths,
    bonusMonths: version.bonusMonths,
    benefits: version.benefits.map((benefit) => ({ ar: benefit.labelAr, en: benefit.labelEn })),
  };
}

/** الباقات المعروضة للبيع الآن، بترتيب العرض. */
export async function listMembershipPlans(db: Db, now: Date): Promise<MembershipPlan[]> {
  const rows = await findMembershipRows(db, now);
  return rows.map(toPlan).filter((plan) => plan !== undefined);
}

export async function findMembershipPlan(
  db: Db,
  slug: string,
  now: Date,
): Promise<MembershipPlan | undefined> {
  const [row] = await findMembershipRows(db, now, slug);
  return row === undefined ? undefined : toPlan(row);
}
