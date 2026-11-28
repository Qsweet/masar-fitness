import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * خط نص اللوحة لا يصل الموقع العام (القرار 91): next/font يحمّل مسبقًا كل `localFont` في رسم وحدات
 * الصفحة، فوحدة الخط لا يستوردها إلا تخطيط اللوحة الجذري، وfonts.ts المشترك بلا ملف Plex.
 */
const SRC = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE = /\.(ts|tsx)$/;
const IMPORTS_ADMIN_FONTS = /from\s+["'][^"']*\/admin-fonts["']/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return SOURCE.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("خط اللوحة معزول عن الموقع العام", () => {
  it("وحدة admin-fonts يستوردها تخطيط اللوحة الجذري وحده", () => {
    const importers = sources(SRC)
      .filter((path) => IMPORTS_ADMIN_FONTS.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path));
    expect(importers).toEqual([join("app", "admin", "layout.tsx")]);
  });

  it("fonts.ts المشترك (يستورده الموقع العام) بلا ملف IBM Plex", () => {
    const shared = readFileSync(join(SRC, "app", "fonts.ts"), "utf8");
    expect(shared).not.toMatch(/plex/i);
  });
});
