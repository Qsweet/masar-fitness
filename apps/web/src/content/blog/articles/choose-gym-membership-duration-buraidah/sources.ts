import type { SharedSource } from "../build";

/** مراجع المسودة بترتيبها: الرقم [n] في النص هو موضع المرجع هنا. */
export const SOURCES: readonly SharedSource[] = [
  {
    title: "Paying Not to Go to the Gym — Stefano DellaVigna, Ulrike Malmendier",
    publisher:
      "American Economic Association (American Economic Review, vol. 96, no. 3, pp. 694–719)",
    url: "https://www.aeaweb.org/articles?id=10.1257/aer.96.3.694",
    lang: "en",
    year: 2006,
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
];
