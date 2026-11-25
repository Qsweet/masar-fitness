/**
 * الإضافات المعروضة مع باقة: المرتبطة بها في `product_addons`، الفعّالة، ولها نسخة سارية الآن.
 * للعرض فقط (خانات صفحة الشراء)؛ ما يُكتب في الطلب تقرره `loadCartLines` و`validateCart` من جديد.
 */
import { money, type LocalizedText, type Money } from "@masar/domain";
import type { Db } from "../client";
import { versionsAt } from "./load-catalog";

export interface PlanAddonOption {
  readonly slug: string;
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  /** سعر القائمة شامل الضريبة، قبل أي خصم. */
  readonly listPrice: Money;
}

function findLinks(db: Db, planSlug: string, now: Date) {
  return db.productAddon.findMany({
    where: { membership: { slug: planSlug, status: "active" }, addon: { status: "active" } },
    // ترتيب العرض نفسه الذي ترتّب به validateCart سطور الإضافات
    orderBy: [{ sortOrder: "asc" }, { addon: { slug: "asc" } }],
    select: {
      addon: {
        select: {
          slug: true,
          nameAr: true,
          nameEn: true,
          summaryAr: true,
          summaryEn: true,
          versions: versionsAt(now),
        },
      },
    },
  });
}

/** إضافات الباقة القابلة للبيع الآن بترتيب عرضها؛ قائمة فارغة لباقة بلا إضافات أو غير موجودة. */
export async function listPlanAddons(
  db: Db,
  planSlug: string,
  now: Date,
): Promise<PlanAddonOption[]> {
  const links = await findLinks(db, planSlug, now);
  return links.flatMap(({ addon }) => {
    const version = addon.versions[0];
    if (version === undefined) {
      return [];
    }
    return [
      {
        slug: addon.slug,
        name: { ar: addon.nameAr, en: addon.nameEn },
        summary: { ar: addon.summaryAr, en: addon.summaryEn },
        listPrice: money(version.priceMinor, version.currency),
      },
    ];
  });
}
