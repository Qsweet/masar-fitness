import type { Page } from "@playwright/test";
import { field, linkAddon, PLANS, seedProduct, type CatalogSeed } from "./admin-catalog-support";

/** بيانات لقطات الكتالوج: كتالوج قريب من الحقيقي (ثلاث باقات وإضافة مرتبطة)، ونموذج منتج مملوء. */
const form = PLANS.form;
export const YEAR = { nameAr: "12 شهرًا + شهران مجانًا", nameEn: "12 months + 2 free" };

export async function fillNewPlan(page: Page, slug: string): Promise<void> {
  await field(page, form.slug).fill(slug);
  await field(page, form.nameAr).fill("3 أشهر + شهر مجانًا");
  await field(page, form.nameEn).fill("3 months + 1 free");
  await field(page, form.summaryAr).fill("كل مرافق النادي في اشتراك واحد.");
  await field(page, form.summaryEn).fill("Every club facility in one membership.");
  await field(page, form.tierAr).fill("انطلاقة الأبطال");
  await field(page, form.tierEn).fill("Champions' Start");
  await field(page, form.price).fill("699");
  await field(page, form.durationMonths).fill("3");
  await field(page, form.bonusMonths).fill("1");
  await page
    .getByLabel(`${form.benefitRow.replace("{number}", "1")}: ${form.benefitAr}`)
    .fill("المسبح");
  await page
    .getByLabel(`${form.benefitRow.replace("{number}", "1")}: ${form.benefitEn}`)
    .fill("Pool");
}

export async function seedCatalog(seed: CatalogSeed) {
  const benefits = ["صالة الحديد|Strength floor", "المسبح|Pool", "الساونا|Sauna"].map((pair) => {
    const [ar = "", en = ""] = pair.split("|");
    return { ar, en, sortOrder: "" };
  });
  const base = {
    summaryAr: "كل مرافق النادي في اشتراك واحد.",
    summaryEn: "Every facility.",
    benefits,
  };
  const six = await seedProduct(seed, {
    ...base,
    nameAr: "6 أشهر + شهران مجانًا",
    nameEn: "6 months + 2 free",
    tierAr: "مسار التغيير",
    tierEn: "The Change Path",
    price: "999",
    durationMonths: "6",
    bonusMonths: "2",
    sortOrder: "2",
  });
  const year = await seedProduct(seed, {
    ...base,
    ...YEAR,
    tierAr: "رحلة الأبطال",
    tierEn: "Champions' Journey",
    price: "1499",
    durationMonths: "12",
    bonusMonths: "2",
    sortOrder: "3",
  });
  const addon = await seedProduct(seed, {
    kind: "addon",
    nameAr: "خزانة خاصة",
    nameEn: "Private locker",
    summaryAr: "خزانة باسمك طوال مدة الاشتراك.",
    summaryEn: "A locker of your own for the whole term.",
    price: "150",
    benefits: [],
  });
  await linkAddon(seed, addon, [six, year]);
  return { six, year, addon };
}
