import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, isDbReachable, Prisma, type Db } from "./index";

const url = process.env.DATABASE_URL;
if (url === undefined || url === "") {
  throw new Error(
    "اختبارات التكامل تحتاج DATABASE_URL لقاعدة اختبار مُرحَّلة (انظر docs/TESTING.md)",
  );
}

const SLUG = "integration-test-club";
/** نسبة ضريبة اختبار بنقاط الأساس (العمود إلزامي بلا افتراضي). */
const TEST_VAT_RATE_BPS = 1500;
let db: Db;

beforeAll(async () => {
  db = createDb(url);
  await db.club.deleteMany({ where: { slug: SLUG } });
});

afterAll(async () => {
  await db.club.deleteMany({ where: { slug: SLUG } });
  await db.$disconnect();
});

describe("قاعدة البيانات", () => {
  it("تجيب على فحص الحياة", async () => {
    expect(await isDbReachable(db)).toBe(true);
  });

  it("فحص الحياة يرجع false بلا رمي عند تعذر الاتصال", async () => {
    const unreachable = createDb("postgresql://nobody:nothing@127.0.0.1:1/none?connect_timeout=1");
    expect(await isDbReachable(unreachable)).toBe(false);
    await unreachable.$disconnect();
  });

  it("تنشئ ناديًا بالقيم الافتراضية الصحيحة", async () => {
    const club = await db.club.create({
      data: {
        slug: SLUG,
        nameAr: "نادي الاختبار",
        nameEn: "Test Club",
        vatRateBps: TEST_VAT_RATE_BPS,
      },
    });
    expect(club.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(club.timezone).toBe("Asia/Riyadh");
    expect(club.currency).toBe("SAR");
    expect(club.vatRateBps).toBe(TEST_VAT_RATE_BPS);
    expect(club.nameAr).toBe("نادي الاختبار");
  });

  it("ترفض تكرار المعرّف النصي للنادي", async () => {
    const duplicate = db.club.create({
      data: { slug: SLUG, nameAr: "مكرر", nameEn: "Dup", vatRateBps: TEST_VAT_RATE_BPS },
    });
    await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
    await expect(duplicate).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
