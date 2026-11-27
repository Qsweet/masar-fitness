import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * قائمة قبول ADMIN_A2_SALES §13 (1): لا `UPDATE` لشروط نسخة سعرية. فحص نصي على كود الإنتاج: النسخة
 * لا يُكتب فيها إلا `valid_until` (إغلاقها عند بداية تاليتها)، ولا تُحذف، ولا يعدّلها عميل Prisma،
 * ومزاياها لا تُستبدل إلا في `change-version.ts` حيث تُفحص النسخة غير مباعة تحت قفلها.
 * T5a يرفض المخالفة في القاعدة؛ هذا الفحص يوقفها قبل أن تصل إلى مراجعة.
 */
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SOURCES = ["packages/db/src", "packages/payments/src", "apps/web/src"];
const SKIPPED = /(?:\.test\.tsx?|[\\/](?:generated|test-support)[\\/])/;
const RAW_UPDATE = /UPDATE\s+"?product_versions"?\s+SET\s+([^`;]*?)\s+WHERE/gis;
const BENEFITS_WRITER = "packages/db/src/catalog-admin/change-version.ts";
const BENEFIT_MUTATION =
  /productBenefit\.(?:update|updateMany|upsert|delete|deleteMany)\(|(?:UPDATE|DELETE\s+FROM)\s+"?product_benefits"?/i;
const FORBIDDEN = [
  /productVersion\.(?:update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\(/,
  /versions:\s*\{\s*(?:update|updateMany|upsert|delete|deleteMany|set)\b/,
  /DELETE\s+FROM\s+"?product_versions"?/i,
  /product\.(?:delete|deleteMany)\(/,
  /DELETE\s+FROM\s+"?(?:products|promotions)"?/i,
  /promotion\.(?:delete|deleteMany)\(/,
];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const files = SOURCES.flatMap((source) => filesUnder(join(ROOT, source)))
  .filter((path) => /\.tsx?$/.test(path) && !SKIPPED.test(path))
  .map((path) => relative(ROOT, path).replaceAll("\\", "/"));

describe("شروط النسخة السعرية لا تُعدَّل", () => {
  it("كل UPDATE خام على product_versions يكتب valid_until وحده", () => {
    expect(files.length).toBeGreaterThan(100);
    const assignments = files.flatMap((file) =>
      [...readFileSync(join(ROOT, file), "utf8").matchAll(RAW_UPDATE)].map(
        (match) => `${file}: ${(match[1] ?? "").replace(/\$\{[^}]*\}/g, "?").trim()}`,
      ),
    );
    expect(assignments).toEqual([
      "packages/db/src/catalog-admin/change-version.ts: valid_until = ?",
    ]);
  });

  it("لا تعديل للنسخ بعميل Prisma، ولا حذف لمنتج أو نسخة أو عرض", () => {
    const offenders = files.filter((file) => {
      const text = readFileSync(join(ROOT, file), "utf8");
      return FORBIDDEN.some((pattern) => pattern.test(text));
    });
    expect(offenders).toEqual([]);
  });

  it("مزايا النسخة لا تُعدَّل إلا في change-version.ts بعد فحص أنها غير مباعة", () => {
    const writers = files.filter((file) =>
      BENEFIT_MUTATION.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(writers).toEqual([BENEFITS_WRITER]);
    const writer = readFileSync(join(ROOT, BENEFITS_WRITER), "utf8");
    expect(writer).toContain("!(await isSold(tx, version.id))");
  });
});
