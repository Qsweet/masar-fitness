import type { SharedSource } from "../build";

const MOH = {
  ar: "وزارة الصحة — المملكة العربية السعودية",
  en: "Ministry of Health — Saudi Arabia",
};

/** مراجع المسودة بترتيبها: الرقم [n] في النص هو موضع المرجع هنا. */
export const SOURCES: readonly SharedSource[] = [
  {
    title:
      "Effects of Ramadan Fasting on Physical Performance: A Systematic Review with Meta-analysis — Abaïdia AE, Daab W, Bouzid MA. Sports Med 50(5):1009–1026, doi:10.1007/s40279-020-01257-0",
    publisher: "Sports Medicine (Springer) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/31960369/",
    year: 2020,
  },
  {
    title:
      "Exercise Training in the Fasted State During the Month of Ramadan: Acutely Ergolytic but Possibly Chronically Ergogenic? A Narrative Review with Systematic Search and Methodological Quality Assessment — Ong JHA, Trabelsi K, … Aziz AR. Sports Med Open 12(1):89, doi:10.1186/s40798-026-01044-7",
    publisher: "Sports Medicine - Open (Springer) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/42400742/",
    year: 2026,
  },
  {
    title:
      "Effect of diurnal fasting on sleep during Ramadan: a systematic review and meta-analysis — Faris MAE, Jahrami HA, … BaHammam AS. Sleep Breath 24(2):771–782, doi:10.1007/s11325-019-01986-1",
    publisher: "Sleep and Breathing (Springer) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/31832984/",
    year: 2020,
  },
  {
    title:
      "Observing Ramadan and sleep-wake patterns in athletes: a systematic review, meta-analysis and meta-regression — Trabelsi K et al. Br J Sports Med 54(11):674–680, doi:10.1136/bjsports-2018-099898",
    publisher: "British Journal of Sports Medicine (BMJ) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/31154342/",
    year: 2020,
  },
  {
    title:
      "Practical recommendations to improve sleep during Ramadan observance in healthy practitioners of physical activity — Trabelsi K et al. Tunis Med 97(10):1077–1086",
    publisher: "La Tunisie Médicale — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/31691935/",
    year: 2019,
  },
  {
    title:
      "Ramadan fasting and the goals of sports nutrition around exercise — Burke LM, King C. J Sports Sci 30 Suppl 1:S21–31, doi:10.1080/02640414.2012.680484",
    publisher: "Journal of Sports Sciences (Taylor & Francis) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/22551533/",
    year: 2012,
  },
  {
    title:
      "Hydration and performance during Ramadan — Maughan RJ, Shirreffs SM. J Sports Sci 30 Suppl 1:S33–41, doi:10.1080/02640414.2012.688140",
    publisher: "Journal of Sports Sciences (Taylor & Francis) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/22594964/",
    year: 2012,
  },
  {
    title:
      "Effect of Ramadan Fasting on Weight and Body Composition in Healthy Non-Athlete Adults: A Systematic Review and Meta-Analysis — Fernando HA et al. Nutrients 11(2):478, doi:10.3390/nu11020478",
    publisher: "Nutrients (MDPI) — PubMed",
    url: "https://pubmed.ncbi.nlm.nih.gov/30813495/",
    year: 2019,
  },
  {
    title: "الرياضة في رمضان: عزِّز صحتك ولا ترهقها",
    publisher: MOH,
    url: "https://www.moh.gov.sa/awarenessplateform/SeasonalAndFestivalHealth/Educational-Content/Pages/Physical-Activity-Ramadan.aspx",
    // آخر تعديل للصفحة: 4 رمضان 1446 هـ (مارس 2025)
    year: 2025,
  },
  {
    title: "الصحة العامة في رمضان يعززها النشاط البدني",
    publisher: { ar: `${MOH.ar} (المركز الإعلامي)`, en: `${MOH.en} (Media Center)` },
    url: "https://www.moh.gov.sa/Ministry/MediaCenter/News/Pages/news-2026-02-23-001.aspx",
    // 5 رمضان 1447 هـ (23 فبراير 2026)
    year: 2026,
  },
];
