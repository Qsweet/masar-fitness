import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * تغطية الحارس (docs/ADMIN_DESIGN.md §4.7): كل صفحة وكل Server Action تحت اللوحة يبدأ بـ
 * `requireStaff(...)` أول سطر. الاستثناء الوحيد صفحة الدخول وإجراؤها، وأول سطر فيهما
 * `requireAdminOpen()`. الفحص على شجرة الصياغة لا على النص، فتعليق أو استدعاء لاحق لا يخدعه.
 */
const SRC = fileURLToPath(new URL("../..", import.meta.url));
const ADMIN_APP = join(SRC, "app/admin");
const ACTIONS = join(SRC, "server/admin/actions");
const LOGIN_EXCEPTIONS = ["app/admin/login/page.tsx", "server/admin/actions/login.ts"];
const PAGE_FILES = new Set(["page.tsx", "layout.tsx"]);
/** التخطيط الجذري للوحة لا يقرأ جلسة ولا بيانات: وسم html والخط فقط. */
const ROOT_LAYOUT = "app/admin/layout.tsx";

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
}

function hasModifier(node: ts.FunctionDeclaration, kind: ts.SyntaxKind): boolean {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function exportedFunctions(source: ts.SourceFile): ts.FunctionDeclaration[] {
  return source.statements
    .filter(ts.isFunctionDeclaration)
    .filter((node) => hasModifier(node, ts.SyntaxKind.ExportKeyword));
}

/** اسم الدالة التي يستدعيها أول سطر في جسم الدالة (مع `await` أو إسناد)، أو null. */
function firstCall(declaration: ts.FunctionDeclaration): string | null {
  const first = declaration.body?.statements[0];
  if (first === undefined) {
    return null;
  }
  let call: string | null = null;
  const visit = (node: ts.Node): void => {
    if (call === null && ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      call = node.expression.text;
      return;
    }
    if (call === null) {
      ts.forEachChild(node, visit);
    }
  };
  visit(first);
  return call;
}

function name(path: string): string {
  return relative(SRC, path).replaceAll("\\", "/");
}

function expectedGuard(file: string): string {
  return LOGIN_EXCEPTIONS.includes(file) ? "requireAdminOpen" : "requireStaff";
}

const pages = filesUnder(ADMIN_APP).filter((path) =>
  PAGE_FILES.has(path.split(/[\\/]/).at(-1) ?? ""),
);
/** Route Handlers تحت اللوحة (المعاينة وما بعدها): كل دالة طريقة HTTP مصدَّرة تبدأ بالحارس. */
const routes = filesUnder(ADMIN_APP).filter((path) => path.split(/[\\/]/).at(-1) === "route.ts");
const actions = filesUnder(ACTIONS).filter(
  (path) => path.endsWith(".ts") && !path.endsWith(".test.ts"),
);

describe("كل صفحة تحت /admin تبدأ بالحارس", () => {
  it("الصفحات موجودة حيث يتوقعها الفحص", () => {
    expect(pages.map(name)).toEqual(expect.arrayContaining(["app/admin/login/page.tsx"]));
    expect(pages.length).toBeGreaterThan(10);
  });

  it.each(pages.map(name).filter((file) => file !== ROOT_LAYOUT))("%s", (file) => {
    const source = parse(join(SRC, file));
    const page = exportedFunctions(source).find((node) =>
      hasModifier(node, ts.SyntaxKind.DefaultKeyword),
    );
    expect(page, "تصدير افتراضي بدالة مسمّاة").toBeDefined();
    expect(page === undefined ? null : firstCall(page)).toBe(expectedGuard(file));
  });
});

describe("كل Server Action تحت اللوحة يبدأ بالحارس", () => {
  it("ملفات الإجراءات موجودة", () => {
    expect(actions.map(name)).toEqual(expect.arrayContaining(["server/admin/actions/login.ts"]));
    expect(actions.length).toBeGreaterThan(3);
  });

  it.each(actions.map(name))("%s", (file) => {
    const source = parse(join(SRC, file));
    expect(source.text.startsWith('"use server";')).toBe(true);
    const exported = exportedFunctions(source);
    expect(exported.length).toBeGreaterThan(0);
    for (const action of exported) {
      expect(hasModifier(action, ts.SyntaxKind.AsyncKeyword)).toBe(true);
      expect(`${action.name?.text ?? "?"}: ${firstCall(action) ?? "لا استدعاء"}`).toBe(
        `${action.name?.text ?? "?"}: ${expectedGuard(file)}`,
      );
    }
    // لا إجراء يُصدَّر بغير تعريف دالة (const أو إعادة تصدير) فيفلت من الفحص
    const otherExports = source.statements.filter(
      (node) =>
        ts.isExportDeclaration(node) ||
        ts.isExportAssignment(node) ||
        (ts.isVariableStatement(node) &&
          (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)),
    );
    expect(otherExports).toEqual([]);
  });

  it("لا إجراء خادم للوحة خارج مجلد الإجراءات", () => {
    const stray = [...filesUnder(ADMIN_APP), ...filesUnder(join(SRC, "components/admin"))]
      .filter((path) => /\.tsx?$/.test(path))
      .filter((path) => /^\s*["']use server["']/m.test(readFileSync(path, "utf8")));
    expect(stray.map(name)).toEqual([]);
  });
});

describe("كل Route Handler تحت اللوحة يبدأ بالحارس", () => {
  it("ملفات المسارات موجودة حيث يتوقعها الفحص", () => {
    expect(routes.map(name)).toEqual(
      expect.arrayContaining(["app/admin/(panel)/content/preview/route.ts"]),
    );
  });

  it.each(routes.map(name))("%s", (file) => {
    const source = parse(join(SRC, file));
    const exported = exportedFunctions(source);
    expect(exported.length).toBeGreaterThan(0);
    for (const handler of exported) {
      expect(`${handler.name?.text ?? "?"}: ${firstCall(handler) ?? "لا استدعاء"}`).toBe(
        `${handler.name?.text ?? "?"}: requireStaff`,
      );
    }
    // لا طريقة تُصدَّر بغير تعريف دالة (const أو إعادة تصدير) فتفلت من الفحص
    const otherExports = source.statements.filter(
      (node) =>
        ts.isExportDeclaration(node) ||
        ts.isExportAssignment(node) ||
        (ts.isVariableStatement(node) &&
          (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)),
    );
    expect(otherExports).toEqual([]);
  });
});

describe("الاستثناءان الوحيدان هما الدخول", () => {
  it("صفحة الدخول وإجراؤها بلا requireStaff، وما عداهما به", () => {
    const withoutStaffGuard = [...pages, ...actions]
      .map(name)
      .filter((file) => file !== ROOT_LAYOUT)
      .filter((file) => !readFileSync(join(SRC, file), "utf8").includes("requireStaff("));
    expect(withoutStaffGuard.sort()).toEqual([...LOGIN_EXCEPTIONS].sort());
  });
});
