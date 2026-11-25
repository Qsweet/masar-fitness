import type { ArticleTranslation } from "../../types";
import { clubFacts, link, note, p, RECOMMENDATION, sourcesFor, steps, table } from "../build";
import { SOURCES } from "./sources";

/**
 * النسخة الإنجليزية منقولة حرفيًا من المسودة المراجَعة (docs/content/drafts/choose-gym-membership-duration-buraidah.md)،
 * عدا حقائق النادي (الاسم والمدينة والعنوان والهاتف): تُملأ من الإعداد والقاموس.
 */
const CLUB = clubFacts("en");

export const EN: ArticleTranslation = {
  title: "One Month, Three Months or a Year? How to Choose a Gym Membership Length in Buraidah",
  description:
    "Choose a membership length by how often you will really train, not today's motivation, and know what to check at a Buraidah gym before you pay.",
  summary:
    "If you are starting from scratch or coming back after a break, pick the shortest term that gives the habit time to settle, then move to a longer term once your attendance has proven itself. Longer terms usually cost less per month, but they save nothing if you do not show up. Before you choose any term, visit the gym at the hour you plan to train and check cleanliness, crowding and the facilities you will actually use.",
  keyTakeaways: [
    "The number that matters is not the monthly price but the cost of each visit you will really make.",
    "People tend to overestimate how often they will go; a well-known economics study of gym members documented exactly that.",
    "Beginners and people returning after a break should start with a short or medium term; people with months of steady training benefit from a long one.",
    "Bonus months in some offers can be worth having, but read the terms first: when they start, and whether they can be frozen.",
    "Inspect the gym yourself: cleanliness, opening hours, crowding at your time, and the facilities you need, such as the pool.",
  ],
  sections: [
    {
      id: "monthly-or-longer",
      heading: "What is the real difference between a monthly and a longer-term membership?",
      blocks: [
        p(
          "The real difference is who carries the risk of you stopping. On a short term you pay more per month for the freedom to quit; on a long term you pay less per month in exchange for committing up front. No term is best for everyone; the right one matches how certain you are about your own attendance.",
        ),
        p(
          'It comes down to one question: how many times a week will I actually go, across the whole term? If your answer is confident and based on past experience, a longer term makes sense. If it is a hope ("this time I\'ll stick with it"), start shorter.',
        ),
      ],
    },
    {
      id: "monthly-price",
      heading: "Why shouldn't I judge by the monthly price alone?",
      blocks: [
        p(
          "Because what you really pay is the membership price divided by the visits you actually make. A plan with a lower monthly price can cost you more per visit if you rarely go.",
        ),
        p(
          "A 2006 study in the American Economic Review, \"Paying Not to Go to the Gym\", documented this. Stefano DellaVigna and Ulrike Malmendier tracked 7,752 members of three US health clubs over three years. Members on a flat monthly contract went 4.3 times a month on average, so they paid more per visit than the clubs' own 10-visit pass would have cost them. The authors' leading explanation was overconfidence about future self-control. [1]",
        ),
        p(
          "The study is American and two decades old, so its numbers do not transfer to Buraidah, but the lesson does: estimate your attendance conservatively. A practical way to do it is to recall the last month you trained regularly and count how often you really went. Base your maths on that number, not on your plan.",
        ),
      ],
    },
    {
      id: "which-length",
      heading: "How do I know which length suits me?",
      blocks: [
        p(
          "The right length depends on where you are with training today. Use this table as a starting point, not a rule:",
        ),
        table(
          ["Where you are now", "Length to consider", "Why"],
          [
            [
              "Never trained, or off for a long time",
              "Short or medium",
              "Test the gym and your training slot before a long commitment",
            ],
            [
              "Training regularly elsewhere and switching",
              "Medium or long",
              "The habit is settled; the only question is the place",
            ],
            [
              "Consistent for months and know your schedule",
              "Long",
              "The lower monthly cost turns into real savings because you will attend",
            ],
            [
              "Long travel or a change in work hours coming",
              "Short, or ask about freezing before a long term",
              "Don't prepay for months you won't be around",
            ],
          ],
        ),
        p(
          "A note for beginners: the WHO 2020 guidelines recommend 150–300 minutes of moderate aerobic activity a week for adults, plus muscle-strengthening on two or more days, and advise people who are not there yet to start small and build up gradually. [2] A realistic plan of two or three sessions a week is a sound start, and it is the plan your cost-per-visit should be based on, not a six-day ideal.",
        ),
        RECOMMENDATION,
      ],
    },
    {
      id: "bonus-months",
      heading: 'What do "bonus months" mean, and how should I read them?',
      blocks: [
        p(
          'Bonus (or "free") months are extra time added to a plan as part of an offer, and their real value depends on the terms, not the count. Before treating them as a win, ask:',
        ),
        steps(
          "When do they start? Are they added at the end of the membership or do they run alongside it?",
          "Does the offer expire? Offers on our site disappear automatically when they end, so what you see on the memberships page is what is available now.",
          "Will you actually use them? An extra month at the end of a year you only half attended adds nothing.",
        ),
        p(
          "The same rule applies: work out the cost per visit over the full term, bonus months included, using a realistic number of visits.",
        ),
      ],
    },
    {
      id: "gym-checklist",
      heading: "What should I check in any gym in Buraidah before paying?",
      blocks: [
        p(
          `Check what you will use every week, at the time you will use it. This list works for any gym, including ${CLUB.name}:`,
        ),
        steps(
          "Visit at your training time. If you will train after work or after isha (night) prayer, visit then. A quiet midday tells you nothing about the evening.",
          "Cleanliness. Changing rooms, showers and the floor around the machines say a lot about how a place is run.",
          "Opening hours. Make sure they fit your working hours, and ask about Ramadan hours, which may change.",
          "The facilities you will really use. If swimming is part of your plan, look at the pool: is it indoor, and does it have lanes you can swim continuous lengths in? If recovery matters to you, ask about the jacuzzi and steam room.",
          "Equipment for your goal. Strength training needs enough free weights and machines at peak hours; functional training needs open floor space.",
          "Distance. A gym on your daily route is easier to stick with than a better one that needs a detour.",
          "The written terms. Read the freeze and refund policies and the start-date rule before you pay, not after.",
        ),
        p(
          `${CLUB.name} is a men's gym in ${CLUB.city}. It has a strength floor, a functional training area with group classes, an indoor pool of graded depth, a jacuzzi, a sauna and a steam room. Address: ${CLUB.address}. See the `,
          link("facilities page", "/#facilities"),
          " and the ",
          link("pool page", "/#water"),
          ` for details, or call ${CLUB.phone} before you visit.`,
        ),
      ],
    },
    {
      id: "try-first",
      heading: "Can I try before committing to a long term?",
      blocks: [
        p(
          "Yes. The surest way is to make your first membership a short one and treat it as your trial: one month shows you the real crowding, how easy the commute is, and whether your training slot works.",
        ),
      ],
    },
    {
      id: "short-then-long",
      heading: "What if I start short and then want a longer plan?",
      blocks: [
        p(
          "Moving from a short term to a long one once the habit has settled is a sound decision, and better than the reverse. As your membership nears its end, look at your attendance record: if you have been going regularly, you now have real evidence for a longer term, and the cost per visit genuinely drops.",
        ),
        note(
          "A brief health note",
          "if you have a chronic condition or a past injury, or you are returning after a long break, talk to your doctor before starting an intensive programme.",
        ),
      ],
    },
  ],
  sources: sourcesFor("en", SOURCES),
};
