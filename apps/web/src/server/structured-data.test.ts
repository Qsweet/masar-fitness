import { describe, expect, it } from "vitest";
import type { Source } from "@/content/blog/types";
import { article, TEST_REVIEWER, translation, without } from "@/test/blog-fixtures";
import { serializeJsonLd, type JsonObject } from "./json-ld";
import { articleGraph, homeGraph, type SiteIdentity } from "./structured-data";

const IDENTITY: SiteIdentity = {
  origin: "https://example.com",
  locale: "ar",
  clubName: "النادي",
  logoUrl: "https://example.com/logo.png",
};

function graph(data: JsonObject): JsonObject[] {
  return data["@graph"] as JsonObject[];
}

function byType(data: JsonObject, type: string): JsonObject {
  const node = graph(data).find((item) => item["@type"] === type);
  if (node === undefined) {
    throw new Error(`no ${type}`);
  }
  return node;
}

const LABELLED_SOURCE: Source = {
  title: "Paper",
  publisher: "Journal",
  url: "https://example.org/paper",
  year: 2020,
  accessed: "2026-11-01",
  lang: "en",
};

/** المعرّفات المعلنة (عقدة بـ@type) والمشار إليها (كائن فيه @id وحده) في الرسم كله. */
function nodeIds(value: unknown, found = { declared: [] as string[], referenced: [] as string[] }) {
  if (Array.isArray(value)) {
    for (const item of value) {
      nodeIds(item, found);
    }
  } else if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    const id = (value as JsonObject)["@id"];
    if (typeof id === "string") {
      (entries.length === 1 ? found.referenced : found.declared).push(id);
    }
    for (const [, item] of entries) {
      nodeIds(item, found);
    }
  }
  return found;
}

const CRUMBS = [
  { name: "الرئيسية", path: "/" },
  { name: "المدونة", path: "/blog" },
  { name: "العنوان", path: "/blog/how-often-to-train" },
];

describe("serializeJsonLd", () => {
  it("لا يمكن لنص المحتوى إغلاق وسم script، والناتج JSON بالقيم نفسها", () => {
    const data = { name: "</script><script>alert(1)</script> & <!--" };
    const text = serializeJsonLd(data);
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("&");
    expect(JSON.parse(text)).toEqual(data);
  });
});

describe("homeGraph", () => {
  const data = homeGraph(IDENTITY, {
    description: "وصف",
    imageUrls: ["https://example.com/a.jpg"],
  });

  it("Organization وExerciseGym وWebSite مترابطة بالمعرّفات", () => {
    expect(graph(data).map((node) => node["@type"])).toEqual([
      "Organization",
      "ExerciseGym",
      "WebSite",
    ]);
    expect(byType(data, "ExerciseGym").parentOrganization).toEqual({
      "@id": "https://example.com/#organization",
    });
  });

  it("العنوان في بريدة والإحداثيات أرقام والهاتف بصيغة دولية", () => {
    const gym = byType(data, "ExerciseGym");
    expect(gym.address).toMatchObject({
      "@type": "PostalAddress",
      addressLocality: "بريدة",
      postalCode: "52581",
      addressCountry: "SA",
    });
    expect(gym.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 26.4077931,
      longitude: 43.9038318,
    });
    expect(gym.telephone).toBe("+966163240111");
  });

  it("ساعات النادي الظاهرة في الصفحة، والإغلاق بعد منتصف الليل كما هو", () => {
    expect(byType(data, "ExerciseGym").openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "06:00",
        closes: "02:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Friday"],
        opens: "13:00",
        closes: "00:00",
      },
    ]);
  });

  it("الحسابات الاجتماعية بروابط التذييل نفسها، والبريد وسنة التأسيس", () => {
    const gym = byType(data, "ExerciseGym");
    expect(gym.sameAs).toEqual([
      "https://www.instagram.com/Mmastersway",
      "https://x.com/mmastersway",
      "https://www.snapchat.com/add/Mmastersway",
      "https://www.tiktok.com/@Mmastersway",
    ]);
    expect(gym.email).toBe("Mmastersway@gmail.com");
    expect(gym.foundingDate).toBe("2018");
  });

  it("لا تقييم ولا آراء (مصدرها موقع آخر) ولا نطاق أسعار", () => {
    const gym = byType(data, "ExerciseGym");
    for (const key of ["aggregateRating", "review", "priceRange"]) {
      expect(gym).not.toHaveProperty(key);
    }
  });
});

describe("articleGraph", () => {
  it("WebPage كيانها BlogPosting بالتواريخ والمراجع، والمراجعة للمنشور", () => {
    const data = articleGraph(IDENTITY, {
      article: article(),
      translation: translation(),
      reviewer: TEST_REVIEWER,
      crumbs: CRUMBS,
    });
    const page = byType(data, "WebPage");
    expect(page.lastReviewed).toBe("2026-11-05");
    expect(page.reviewedBy).toMatchObject({ "@type": "Person", name: "مراجع الاختبار" });
    const posting = page.mainEntity as JsonObject;
    expect(posting).toMatchObject({
      "@type": "BlogPosting",
      headline: "كم مرة أتمرن في الأسبوع؟",
      datePublished: "2026-11-01",
      dateModified: "2026-11-10",
      inLanguage: "ar",
      mainEntityOfPage: { "@id": "https://example.com/blog/how-often-to-train#webpage" },
    });
    expect(posting.author).toMatchObject({ "@type": "Organization", name: "النادي" });
    expect(posting.publisher).toMatchObject({ logo: { url: "https://example.com/logo.png" } });
    expect(posting.citation).toEqual([
      expect.objectContaining({ url: "https://example.org/guide", datePublished: "2024" }),
    ]);
  });

  it("مسار التنقل بروابط مطلقة ومواضع متتالية", () => {
    const data = articleGraph(
      { ...IDENTITY, locale: "en" },
      {
        article: article(),
        translation: translation(),
        reviewer: TEST_REVIEWER,
        crumbs: CRUMBS,
      },
    );
    const list = byType(data, "BreadcrumbList").itemListElement as JsonObject[];
    expect(list.map((item) => [item.position, item.item])).toEqual([
      [1, "https://example.com/en"],
      [2, "https://example.com/en/blog"],
      [3, "https://example.com/en/blog/how-often-to-train"],
    ]);
  });

  it("isPartOf يشير إلى WebSite معلَن في الرسم نفسه، ولغة المرجع inLanguage", () => {
    const data = articleGraph(IDENTITY, {
      article: article(),
      translation: translation({ sources: [LABELLED_SOURCE] }),
      reviewer: TEST_REVIEWER,
      crumbs: CRUMBS,
    });
    const website = byType(data, "WebSite");
    expect(byType(data, "WebPage").isPartOf).toEqual({ "@id": website["@id"] });
    expect(website).toMatchObject({
      "@id": "https://example.com/#website",
      publisher: { "@id": "https://example.com/#organization" },
    });
    const posting = byType(data, "WebPage").mainEntity as JsonObject;
    expect(posting.citation).toEqual([expect.objectContaining({ inLanguage: "en" })]);
  });

  it("كل إشارة ({@id} وحده) إلى عقدة معلنة في الرسم نفسه", () => {
    const data = articleGraph(IDENTITY, {
      article: article(),
      translation: translation(),
      reviewer: TEST_REVIEWER,
      crumbs: CRUMBS,
    });
    const { declared, referenced } = nodeIds(data);
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(declared, id).toContain(id);
    }
  });

  it("المسودة: لا مراجعة معلنة ولا تاريخ نشر", () => {
    const rest = without(article({ status: "draft" }), "publishedAt");
    const data = articleGraph(IDENTITY, {
      article: rest,
      translation: translation(),
      reviewer: TEST_REVIEWER,
      crumbs: CRUMBS,
    });
    const page = byType(data, "WebPage");
    expect(page).not.toHaveProperty("lastReviewed");
    expect(page).not.toHaveProperty("reviewedBy");
    expect(page.mainEntity).not.toHaveProperty("datePublished");
  });
});
