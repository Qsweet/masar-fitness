import type { ArticleTranslation } from "../../types";
import { list, p, RECOMMENDATION, sourcesFor, steps, table } from "../build";
import { SOURCES } from "./sources";

/** النسخة الإنجليزية منقولة حرفيًا من المسودة المراجَعة (docs/content/drafts/how-much-exercise-per-week-who-guidelines.md). */
export const EN: ArticleTranslation = {
  title: "How Much Exercise Do Adults Need Each Week? The WHO Guidelines, Made Practical",
  description:
    "WHO recommends adults get 150–300 minutes of moderate activity a week plus strength work on two or more days. What the numbers mean and how to fit them in.",
  summary:
    "The World Health Organization's 2020 guidelines recommend that adults aged 18–64 do 150–300 minutes of moderate-intensity aerobic activity a week, or 75–150 minutes of vigorous activity, or an equivalent mix, plus muscle-strengthening on two or more days a week. WHO stresses that any activity is better than none, and that cutting down on long periods of sitting is worthwhile in its own right.",
  keyTakeaways: [
    "The weekly target for adults is 150–300 moderate minutes, 75–150 vigorous minutes, or an equivalent mix.",
    "Strength training for all major muscle groups on at least two days a week is a separate recommendation from the aerobic minutes.",
    "Every minute counts: the 2020 guidelines dropped the old rule that activity had to come in bouts of at least 10 minutes.",
    "Adults aged 65 and over add activity that combines different types of exercise and emphasises balance and strength, on three or more days a week.",
    "Start small and build up gradually; that is part of the recommendation itself.",
  ],
  sections: [
    {
      id: "minutes-per-week",
      heading: "How many minutes of exercise does an adult need per week?",
      blocks: [
        p(
          "Adults aged 18–64 need 150–300 minutes a week of moderate-intensity aerobic activity, or 75–150 minutes of vigorous activity, or an equivalent combination. That is WHO's recommendation in its guidelines on physical activity and sedentary behaviour, published on 25 November 2020. [1][2]",
        ),
        p(
          'What changed in 2020 is that WHO now gives a range, not just a minimum. The 2010 guidance said "at least 150 minutes"; the 2020 guidance says 150 to 300, because most of the major health benefits are captured within that range. [2] WHO adds that going beyond 300 moderate minutes (or 150 vigorous) may bring additional benefits. That part is a "conditional" recommendation, meaning the evidence is weaker. For people with chronic conditions, it applies only when there is no medical reason against it. [2]',
        ),
        p("The table below summarises the recommendations by age:"),
        table(
          ["Group", "Aerobic activity per week", "Muscle strengthening", "Also"],
          [
            [
              "Adults 18–64",
              "150–300 min moderate, or 75–150 min vigorous, or an equivalent mix",
              "2+ days, all major muscle groups",
              "Limit sedentary time",
            ],
            [
              "Older adults 65+",
              "As for adults",
              "As for adults",
              "Multicomponent balance and strength work on 3+ days",
            ],
          ],
        ),
        p(
          "Source: WHO 2020 guidelines as summarised by the guideline team in the British Journal of Sports Medicine. [2]",
        ),
      ],
    },
    {
      id: "moderate-or-vigorous",
      heading: "What is the difference between moderate and vigorous activity?",
      blocks: [
        p(
          "Moderate activity is effort you would rate around 5 or 6 out of 10, and vigorous activity is around 7 or 8 out of 10, on a 0–10 scale of perceived exertion relative to your own capacity. [2]",
        ),
        p(
          "The guidelines also define intensity in METs (metabolic equivalents): moderate activity is 3 to just under 6 times your resting energy use, and vigorous is 6 times or more. [2] In practice, intensity depends on your effort, not on the sport. Swimming lengths in the club pool can be moderate at an easy pace and vigorous at a hard, continuous one; the same goes for the exercise bike or the elliptical.",
        ),
        p(
          "Because the guideline pairs 150 moderate minutes with 75 vigorous minutes, one vigorous minute counts roughly as two moderate minutes when you build a mix.",
        ),
      ],
    },
    {
      id: "short-bouts",
      heading: "Do short bouts, like 10 minutes, count?",
      blocks: [
        p(
          "Yes. Every minute of moderate or vigorous activity counts towards your weekly total, however short, though the target is still at least 150 moderate minutes or the equivalent. The 2020 guidelines removed the old requirement for bouts of at least 10 minutes because the evidence showed that activity of any bout length is linked with better health outcomes. [2]",
        ),
        p(
          "That opens up realistic options for people with long working days: a brisk walk after prayer, taking the stairs, or a short gym session. WHO's fact sheet puts it plainly: any amount of physical activity is better than none, and all physical activity counts. [3]",
        ),
        RECOMMENDATION,
      ],
    },
    {
      id: "strength-days",
      heading: "How many days a week should I do strength training?",
      blocks: [
        p(
          "At least two days a week of muscle-strengthening work, covering all major muscle groups at moderate or greater intensity. That is WHO's recommendation for adults. [2] It is separate from the aerobic minutes: someone who walks 150 minutes a week still needs strength training.",
        ),
        p(
          "Strength work is not only free weights. Machines, bodyweight exercises and functional training all count. Notably, the guideline team found no evidence that doing more strength training than that keeps increasing the health benefit in proportion [2], so two or three consistent days are an excellent starting point for most people.",
        ),
      ],
    },
    {
      id: "weekly-examples",
      heading: "How do I spread it across my week? Three examples",
      blocks: [
        p(
          "These examples turn the numbers into a schedule. They are not training programmes, and a coach should adapt them to your level:",
        ),
        steps(
          "Moderate week: 5 days × 30 minutes of brisk walking or swimming at a moderate effort = 150 moderate minutes, with two of those days starting with a full-body strength session.",
          "Intense week: 3 days × 25 minutes of hard effort (fast swimming or a tough bike pace) = 75 vigorous minutes, plus two strength days.",
          "Mixed week: two strength days, each finishing with 20 minutes of hard effort (40 vigorous ≈ 80 moderate), plus 70 minutes of brisk walking spread over the week ≈ 150 moderate-equivalent minutes.",
        ),
        p(
          "If all of that feels far off, WHO's own advice applies: start with small amounts and gradually increase frequency, intensity and duration. [2]",
        ),
      ],
    },
    {
      id: "why-it-matters",
      heading: "Why does WHO care about these numbers?",
      blocks: [
        p(
          "Because physical inactivity is one of the leading risk factors for death from noncommunicable diseases: people who are insufficiently active have a 20–30% higher risk of death than those who are sufficiently active, according to WHO's fact sheet dated 4 November 2026. [3]",
        ),
        p(
          "The guidelines link regular activity in adults with lower all-cause and cardiovascular mortality, fewer new cases of high blood pressure, type 2 diabetes and some cancers, and improvements in anxiety and depression symptoms and in sleep. [2] These are population-level associations, not a promise of any individual result.",
        ),
        p(
          "Even so, 31% of adults worldwide, about 1.8 billion people, do not reach 150 minutes of moderate activity a week, based on the 2022 data WHO reports. [3]",
        ),
      ],
    },
    {
      id: "sitting",
      heading: "What about sitting for long periods?",
      blocks: [
        p(
          "Sit less where you can and replace some of that time with any movement, even light movement; this is a separate recommendation in the 2020 guidelines. [2] WHO did not set a maximum number of sitting hours because the evidence was not strong enough, but it advises people who sit a lot to aim for more than the recommended level of moderate-to-vigorous activity to help offset it. [2]",
        ),
      ],
    },
    {
      id: "see-a-professional",
      heading: "When should you see a professional?",
      blocks: [
        list(
          "See your doctor before starting if you have a chronic condition (such as heart disease, diabetes or high blood pressure) or an injury, if you are pregnant, or if you plan to go straight into vigorous training after a long break.",
          "Otherwise, WHO's guidelines state that medical clearance before exercise is generally unnecessary for people without contraindications who are starting light or moderate activity no harder than brisk walking. [2]",
          "Stop and get help immediately if you feel chest pain, unusual breathlessness or severe dizziness.",
        ),
        p("This article is general education and does not replace individual medical advice."),
      ],
    },
  ],
  sources: sourcesFor("en", SOURCES),
};
