import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLUB_CONTACT } from "@/config/club";
import { defaultDictionary } from "@/i18n/dictionaries";
import { LOCALES } from "@/i18n/locales";
import { ARTICLES } from "../articles";
import { clubFacts, sourcesFor, type SharedSource } from "./build";

const ARTICLES_DIR = fileURLToPath(new URL(".", import.meta.url));

/** نص كل ملف محتوى في مجلدات المقالات (بلا الاختبارات). */
function contentFiles(): { readonly path: string; readonly text: string }[] {
  return readdirSync(ARTICLES_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
    .map((path) => ({ path, text: readFileSync(join(ARTICLES_DIR, path), "utf8") }));
}

describe("sourcesFor: لغة المرجع", () => {
  const shared: SharedSource = {
    title: "Paper",
    publisher: "Journal",
    url: "https://example.org/a",
    year: 2020,
    lang: "en",
  };
  const localized: SharedSource = {
    title: "صفحة",
    publisher: { ar: "وزارة", en: "Ministry" },
    url: "https://example.org/b",
    year: 2025,
    lang: "ar",
  };

  it("اللغة على العنوان دائمًا، وعلى الناشر فقط إن كان نصًا واحدًا للغتين", () => {
    const [paper, page] = sourcesFor("en", [shared, localized]);
    expect(paper).toMatchObject({ lang: "en", publisherLang: "en" });
    expect(page).toMatchObject({ lang: "ar", publisher: "Ministry" });
    expect(page).not.toHaveProperty("publisherLang");
  });

  it("بلا لغة معلنة: لا خاصية lang", () => {
    const unlabelled: SharedSource = {
      title: shared.title,
      publisher: shared.publisher,
      url: shared.url,
      year: shared.year,
    };
    const [source] = sourcesFor("ar", [unlabelled]);
    expect(source).not.toHaveProperty("lang");
    expect(source).not.toHaveProperty("publisherLang");
  });

  it("كل مرجع في المقالات الحقيقية معلَن اللغة", () => {
    for (const article of ARTICLES) {
      for (const locale of LOCALES) {
        for (const source of article.translations[locale]?.sources ?? []) {
          expect(source.lang, `${article.slug} [${locale}] ${source.url}`).toMatch(/^(ar|en)$/u);
        }
      }
    }
  });
});

describe("حقائق النادي في المقالات من الإعداد والقاموس", () => {
  it("clubFacts تقرأ الاسم والعنوان والهاتف من مصدرها", () => {
    for (const locale of LOCALES) {
      expect(clubFacts(locale)).toMatchObject({
        name: defaultDictionary(locale).club.name,
        address: CLUB_CONTACT.address[locale],
        phone: CLUB_CONTACT.phoneDisplay,
      });
    }
  });

  it("لا اسم ولا عنوان ولا هاتف مكتوب باليد في ملفات المقالات", () => {
    const literals = [
      ...LOCALES.map((locale) => defaultDictionary(locale).club.name),
      ...LOCALES.map((locale) => CLUB_CONTACT.address[locale]),
      CLUB_CONTACT.phoneDisplay,
      CLUB_CONTACT.phoneE164,
      "4870",
      "324 0111",
    ];
    for (const { path, text } of contentFiles()) {
      for (const literal of literals) {
        expect(text.includes(literal), `${path}: ${literal}`).toBe(false);
      }
    }
  });

  it("مقال مدة الاشتراك يعرض الحقائق نفسها التي في الإعداد", () => {
    const article = ARTICLES.find(({ slug }) => slug === "choose-gym-membership-duration-buraidah");
    for (const locale of LOCALES) {
      const text = JSON.stringify(article?.translations[locale]);
      const facts = clubFacts(locale);
      for (const fact of [facts.name, facts.address, facts.phone]) {
        expect(text, `${locale}: ${fact}`).toContain(fact);
      }
    }
  });
});
