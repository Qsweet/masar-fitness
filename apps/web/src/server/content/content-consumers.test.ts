import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isUnder } from "@masar/domain";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { textRegistry } from "./registry";

/**
 * حارس إعادة الربط (ADMIN_A3_CONTENT §4.2): نص قابل للتعديل يُقرأ من `getSiteContent` وحده، وإلا بقي
 * ثابتًا بعد النشر. الفحص على شجرة الصياغة لكل ملف غير اختباري:
 * - كل `defaultDictionary(...)` يليه وصول إلى خاصية (أو تفكيك بأسماء) لا تحت أي منها نص قابل للتعديل.
 * - كل ملف `"use client"` لا يستورد قيمة (لا نوعًا) من القواميس ولا من حقائق `config/`.
 */
const SRC = fileURLToPath(new URL("../..", import.meta.url));
/**
 * استثناءات معلنة: المُحلِّل نفسه (يدمج فوق الافتراضي)؛ صفحة الخطأ عميل تعمل والقاعدة معطلة؛
 * والمقالات على الافتراضي حتى A4 (§13).
 */
const DICTIONARY_EXCEPTIONS = [
  "server/content/site-content.ts",
  "app/[locale]/error.tsx",
  "content/blog/articles/build.ts",
];
const CLIENT_EXCEPTIONS = ["app/[locale]/error.tsx"];
const CLIENT_FORBIDDEN = [
  /\/i18n\/dictionaries(\/|$)/,
  /\/config\/(club|club-facts|hours|payment-marks)$/,
];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const SOURCES = filesUnder(SRC)
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
  .map((path) => ({ name: relative(SRC, path).replaceAll("\\", "/"), path }));

const editablePaths = [...textRegistry().editable.keys()];
const reachesEditable = (prefix: string) => editablePaths.some((path) => isUnder(path, prefix));

/** ما يُقرأ من نتيجة الاستدعاء: سلسلة الخصائص، أو أسماء التفكيك، أو null لاستعمال كامل. */
function accessedPrefixes(call: ts.CallExpression): string[] | null {
  let node: ts.Node = call;
  const chain: string[] = [];
  while (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) {
    chain.push(node.parent.name.text);
    node = node.parent;
  }
  if (chain.length > 0) {
    return [chain.join(".")];
  }
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name)) {
    return parent.name.elements.map((element) => (element.propertyName ?? element.name).getText());
  }
  return null;
}

function dictionaryViolations(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defaultDictionary"
    ) {
      const prefixes = accessedPrefixes(node);
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (prefixes === null) {
        found.push(`${String(line)}: القاموس كله`);
      } else {
        found.push(...prefixes.filter(reachesEditable).map((p) => `${String(line)}: ${p}`));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
}

function clientValueImports(source: ts.SourceFile): string[] {
  return source.statements
    .filter(ts.isImportDeclaration)
    .filter((node) => node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword)
    .filter((node) => {
      const bindings = node.importClause?.namedBindings;
      const named = bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : [];
      return node.importClause?.name !== undefined || named.some((item) => !item.isTypeOnly);
    })
    .map((node) => (node.moduleSpecifier as ts.StringLiteral).text)
    .filter((specifier) => CLIENT_FORBIDDEN.some((pattern) => pattern.test(specifier)));
}

describe("المساحات القابلة للتعديل لا تُقرأ من القاموس الثابت", () => {
  it.each(
    SOURCES.filter((file) => !DICTIONARY_EXCEPTIONS.includes(file.name)).map((file) => [
      file.name,
      file.path,
    ]),
  )("%s", (_name, path) => {
    expect(dictionaryViolations(parse(path))).toEqual([]);
  });

  it("الفحص يلتقط القاموس كله والمساحة القابلة للتعديل والتفكيك", () => {
    const sample = ts.createSourceFile(
      "sample.ts",
      [
        "const a = defaultDictionary(locale);",
        "const b = defaultDictionary(locale).hero.title;",
        "const { checkout, meta } = defaultDictionary(locale);",
        "const c = defaultDictionary(locale).club.logoAlt;",
        "const d = defaultDictionary(locale).plans.bonus;",
      ].join("\n"),
      ts.ScriptTarget.Latest,
      true,
    );
    expect(dictionaryViolations(sample)).toEqual(["1: القاموس كله", "2: hero.title", "3: meta"]);
  });
});

describe("مكوّنات العميل لا تحمل القاموس ولا حقائق النادي في حزمة المتصفح", () => {
  const clients = SOURCES.filter((file) =>
    /^\s*["']use client["']/.test(readFileSync(file.path, "utf8")),
  ).filter((file) => !CLIENT_EXCEPTIONS.includes(file.name));

  it("ملفات العميل موجودة حيث يتوقعها الفحص", () => {
    expect(clients.length).toBeGreaterThan(10);
  });

  it.each(clients.map((file) => [file.name, file.path]))("%s", (_name, path) => {
    expect(clientValueImports(parse(path))).toEqual([]);
  });

  it("الفحص يلتقط استيراد قيمة ويترك النوع", () => {
    const sample = ts.createSourceFile(
      "sample.tsx",
      [
        'import { defaultDictionary, type Dictionary } from "@/i18n/dictionaries";',
        'import type { Dictionary as D } from "@/i18n/dictionaries";',
        'import { whatsappUrl } from "@/config/club";',
        'import { type CLUB_CONTACT } from "@/config/club";',
      ].join("\n"),
      ts.ScriptTarget.Latest,
      true,
    );
    expect(clientValueImports(sample)).toEqual(["@/i18n/dictionaries", "@/config/club"]);
  });
});

describe("خريطة الموقع وllms.txt والخلاصة وrobots تقرأ المنشور دائمًا، بلا معاينة", () => {
  it.each([
    "app/sitemap.ts",
    "app/robots.ts",
    "app/llms.txt/route.ts",
    "app/[locale]/blog/feed.xml/route.ts",
  ])("%s", (file) => {
    const text = readFileSync(join(SRC, file), "utf8");
    expect(text).not.toContain("getSiteContent");
    expect(text).not.toContain("previewTexts");
  });
});
