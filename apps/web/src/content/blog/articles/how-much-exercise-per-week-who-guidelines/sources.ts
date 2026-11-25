import type { SharedSource } from "../build";

/** مراجع المسودة بترتيبها: الرقم [n] في النص هو موضع المرجع هنا. */
export const SOURCES: readonly SharedSource[] = [
  {
    title: "WHO guidelines on physical activity and sedentary behaviour (ISBN 9789240015128)",
    publisher: "World Health Organization",
    url: "https://www.who.int/publications/i/item/9789240015128",
    lang: "en",
    year: 2020,
  },
  {
    title:
      "World Health Organization 2020 guidelines on physical activity and sedentary behaviour — Bull FC et al., Br J Sports Med 54(24):1451–1462, doi:10.1136/bjsports-2020-102955",
    publisher: {
      ar: "British Journal of Sports Medicine (BMJ) — عبر PubMed Central",
      en: "British Journal of Sports Medicine (BMJ) — via PubMed Central",
    },
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/",
    lang: "en",
    year: 2020,
  },
  {
    title: "Physical activity (Fact sheet)",
    publisher: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
    lang: "en",
    year: 2026,
  },
];
