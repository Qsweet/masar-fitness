import { buildTextRegistry, type TextRegistry } from "./registry";

/** سجل صغير لاختبارات المحتوى: قوالب بعناصر نائبة، وعنوان بحث، وممنوع. */
export const TEST_DICTIONARIES = {
  ar: {
    hero: { title: "أقوى نسخة منك", pause: "أوقف" },
    goals: { line: "صالة بأكثر من {count} جهازًا." },
    meta: { homeTitle: "نادي رياضي رجالي في بريدة" },
    about: {
      paragraphs: [
        "فقرة أولى طويلة بما يكفي لتكون فقرة كاملة في الصفحة تصف النادي وتاريخه ومرافقه بالتفصيل، وتذكر الحي والمدينة وكل ما فيه من أجهزة وحصص ومسبح وساونا.",
      ],
    },
  },
  en: {
    hero: { title: "The strongest you", pause: "Pause" },
    goals: { line: "Over {count} machines." },
    meta: { homeTitle: "A men's gym in Buraidah" },
    about: { paragraphs: ["A first paragraph."] },
  },
};

export function testRegistry(): TextRegistry {
  return buildTextRegistry(
    TEST_DICTIONARIES,
    [
      { prefix: "hero", permission: "content.write" },
      { prefix: "hero.pause", locked: "accessibility" },
      { prefix: "goals", permission: "content.write" },
      { prefix: "meta", permission: "content.write" },
      { prefix: "about", permission: "content.write" },
    ],
    (text) => `hash:${text}`,
  );
}
