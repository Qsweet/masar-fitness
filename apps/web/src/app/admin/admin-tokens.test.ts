import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * رموز اللوحة v2 (ADMIN_REDESIGN §3.1): نسب التباين محسوبة من admin.css نفسه في المظهرين، ولا لون خام
 * في وحدات CSS اللوحة. اللون الشفاف يُمزج فوق سطحه قبل الحساب، كما يراه المستخدم.
 */
const CSS = readFileSync(fileURLToPath(new URL("./admin.css", import.meta.url)), "utf8");
const COMPONENTS = fileURLToPath(new URL("../../components/admin", import.meta.url));

type Rgb = readonly [number, number, number];
type Tokens = ReadonlyMap<string, string>;

function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  const body = CSS.slice(CSS.indexOf("{", start) + 1);
  return body.slice(0, body.indexOf("}"));
}

function tokensOf(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of text.matchAll(/(--a-[a-z0-9-]+):\s*([^;]+);/g)) {
    map.set(match[1] ?? "", (match[2] ?? "").trim());
  }
  return map;
}

const DARK = tokensOf(block('html[data-admin] [data-surface="dark"]'));
const LIGHT = new Map([...DARK, ...tokensOf(block('html[data-admin][data-theme="light"]'))]);

function parse(value: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex !== null) {
    const n = Number.parseInt(hex[1] ?? "", 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)%\)$/.exec(value);
  if (rgb === null) {
    throw new Error(`لون غير مفهوم: ${value}`);
  }
  const [r, g, b, a] = rgb.slice(1).map(Number);
  return { rgb: [r ?? 0, g ?? 0, b ?? 0], alpha: (a ?? 0) / 100 };
}

function color(tokens: Tokens, name: string, under?: Rgb): Rgb {
  const { rgb, alpha } = parse(tokens.get(name) ?? "");
  const base = under ?? rgb;
  const mix = (i: 0 | 1 | 2): number => rgb[i] * alpha + base[i] * (1 - alpha);
  return [mix(0), mix(1), mix(2)];
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

function ratio(tokens: Tokens, fg: string, bg: string): number {
  const background = color(tokens, bg);
  return contrast(color(tokens, fg, background), background);
}

const THEMES = { dark: DARK, light: LIGHT } as const;
const TEXT_ON = ["--a-surface", "--a-overlay", "--a-page", "--a-raised", "--a-sunken"];

describe.each(Object.entries(THEMES))("المظهر %s", (_, tokens) => {
  it.each(["--a-text", "--a-muted", "--a-subtle"])("%s نص AA على كل الأسطح", (fg) => {
    for (const bg of TEXT_ON) {
      expect(ratio(tokens, fg, bg), `${fg} على ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("الأصفر: نص أسود على التعبئة، والنص المميَّز AA", () => {
    expect(ratio(tokens, "--a-on-accent", "--a-accent")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tokens, "--a-accent-text", "--a-surface")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tokens, "--a-focus", "--a-page")).toBeGreaterThanOrEqual(3);
  });

  it.each(["--a-success", "--a-warning", "--a-danger", "--a-info"])(
    "%s نص AA على السطح وعلى خلفيته الشفيفة",
    (fg) => {
      expect(ratio(tokens, fg, "--a-surface")).toBeGreaterThanOrEqual(4.5);
      const soft = color(tokens, `${fg}-soft`, color(tokens, "--a-surface"));
      expect(contrast(color(tokens, fg), soft)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("حد الحقل وعلامات الرسوم 3:1 على السطح (WCAG 1.4.11)", () => {
    for (const fg of ["--a-field-border", "--a-viz-1", "--a-viz-2", "--a-viz-3", "--a-viz-4"]) {
      expect(ratio(tokens, fg, "--a-surface"), fg).toBeGreaterThanOrEqual(3);
    }
    expect(ratio(tokens, "--a-viz-5", "--a-surface")).toBeGreaterThanOrEqual(3);
  });
});

it("الشريط الجانبي داكن في المظهرين: نصه AA على أرضيته الثابتة", () => {
  expect(tokensOf(block('html[data-admin][data-theme="light"]')).has("--a-sidebar")).toBe(false);
  for (const fg of ["--a-text", "--a-muted", "--a-subtle"]) {
    expect(ratio(DARK, fg, "--a-sidebar")).toBeGreaterThanOrEqual(4.5);
  }
});

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return cssFiles(path);
    }
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

it("لا لون خام في وحدات CSS اللوحة: الرموز وحدها", () => {
  const raw = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i;
  const offenders = cssFiles(COMPONENTS).filter((path) => raw.test(readFileSync(path, "utf8")));
  expect(offenders).toEqual([]);
});
