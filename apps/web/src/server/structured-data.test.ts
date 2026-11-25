import { describe, expect, it } from "vitest";
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

  it("لا حقائق غير مؤكدة: لا تقييم ولا ساعات عمل ولا نطاق أسعار", () => {
    const gym = byType(data, "ExerciseGym");
    for (const key of [
      "aggregateRating",
      "review",
      "openingHours",
      "openingHoursSpecification",
      "priceRange",
    ]) {
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
