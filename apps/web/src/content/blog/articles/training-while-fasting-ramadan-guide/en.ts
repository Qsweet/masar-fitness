import type { ArticleTranslation } from "../../types";
import { list, p, RECOMMENDATION, sourcesFor, steps, table } from "../build";
import { SOURCES } from "./sources";

/** النسخة الإنجليزية منقولة حرفيًا من المسودة المراجَعة (docs/content/drafts/training-while-fasting-ramadan-guide.md). */
export const EN: ArticleTranslation = {
  title: "Training While Fasting in Ramadan: When to Work Out and How to Maintain Your Fitness",
  description:
    "When to train in Ramadan, whether you'll lose muscle, and how to handle sleep and thirst, based on research reviews and Saudi Ministry of Health guidance.",
  summary:
    "Most healthy people can keep training through Ramadan. Do hard sessions two to three hours after iftar, or once taraweeh is over, and keep anything before iftar light. Research reviews in athletes show that strength and aerobic fitness are usually unaffected by fasting, while power in repeated short sprints drops. Sleep also tends to shrink during the month, so plan it like you plan training. If you have a chronic condition, talk to your doctor first.",
  keyTakeaways: [
    "Before iftar: light activity only, such as walking and stretching.",
    "Hard training (heavy lifting, running, team sports): about three hours after iftar, or after taraweeh.",
    "Don't stop strength training; reduce the load if you need to, but keep showing up.",
    "Sleep drops by about an hour a night on average during Ramadan, so plan it like you plan training.",
    "Drink steadily between iftar and suhoor, and avoid hard efforts in the heat before iftar.",
  ],
  sections: [
    {
      id: "training-while-fasting",
      heading: "Can I train while fasting, and will it hurt my performance?",
      blocks: [
        p(
          "For healthy people, training through Ramadan is workable and most performance measures change little. A 2020 systematic review in Sports Medicine pooled 11 studies of athletes and found that strength, aerobic performance and jump height were not affected by Ramadan fasting, while peak power in repeated-sprint tests fell and morning sprint performance was affected. [1]",
        ),
        p(
          "A newer narrative review in Sports Medicine – Open (2026) proposed that training in the fasted state may impair performance in the session itself but does not necessarily blunt longer-term progress, provided training load, recovery, and eating and drinking after training are well managed. The authors stressed that the evidence is limited and mixed, and that fasted training should not be seen as generally better than fed training. [2]",
        ),
        p(
          "Keep in mind that these studies mostly involve athletes and active people. If you are a beginner, be more cautious. Saudi Arabia's Ministry of Health (MOH) advises anyone with a health problem to consult their doctor before any physical activity. [9]",
        ),
      ],
    },
    {
      id: "best-time",
      heading: "When is the best time to work out in Ramadan?",
      blocks: [
        p(
          "The best time for hard training in Ramadan is two to three hours after iftar, or once taraweeh prayers are over; before iftar, stick to light activity. This is what the MOH awareness page and a specialist quoted by the MOH say, with small differences in the exact number of hours, while the sports nutrition review more generally advises training when you can eat and drink around it:",
        ),
        table(
          ["Time", "Best for", "Source"],
          [
            [
              "The hour before maghrib",
              "Easy walking, stretching, light exercise. No intense training",
              "Specialist view reported by the MOH [10]",
            ],
            [
              "Two hours after iftar",
              "Your normal session, once digestion is largely done and energy has been replenished",
              "MOH awareness page [9]",
            ],
            [
              "At least three hours after iftar",
              "High-effort work: strength training, running, team sports",
              "Specialist view reported by the MOH [10]",
            ],
            [
              "After taraweeh",
              "A full session, with time to eat and drink afterwards",
              "MOH [9]; Burke and King [6]",
            ],
            [
              "Before suhoor",
              "An option for night owls, with suhoor afterwards",
              "Burke and King [6]",
            ],
          ],
        ),
        p(
          "The reasoning: sports nutrition guidelines usually call for protein, carbohydrate and fluids soon after a session, so Burke and King's review in the Journal of Sports Sciences recommends moving training, where possible, to the start or end of the day or the evening, when you can eat and drink around it. [6]",
        ),
        p("Pick the slot that fits your sleep and work, then keep it for the whole month."),
        RECOMMENDATION,
      ],
    },
    {
      id: "muscle",
      heading: "Will I lose muscle if I lift weights during Ramadan?",
      blocks: [
        p(
          "The review cited here measured strength rather than muscle size, and it does not show a drop in strength among athletes who fast in Ramadan. [1] The most important thing is to keep strength training going all month.",
        ),
        p("Three practical rules:"),
        steps(
          "Keep your usual number of sessions, and cut the load or the number of sets if you feel unusually tired.",
          "Lift after iftar so you can eat and drink afterwards, as the sports nutrition review advises. [6]",
          "Don't chase personal bests while fasted.",
        ),
      ],
    },
    {
      id: "fluids",
      heading: "How should I handle thirst and fluids?",
      blocks: [
        p(
          "Drink steadily between iftar and suhoor, and avoid hard training in the heat before iftar. Maughan and Shirreffs' review in the Journal of Sports Sciences explains that a resting person in a temperate climate loses about 1% of body mass as water by sunset, which is unlikely to matter much. But losses grow in hot weather and with exercise, and performance may start to suffer at a loss of 1–2% of body mass. The good news is that these losses can be fully replaced overnight. [7]",
        ),
        p(
          "The MOH awareness page advises exercising in well-ventilated places in mild conditions [9], and a specialist quoted by the MOH stresses drinking enough water between iftar and suhoor. [10] That favours an air-conditioned indoor session after iftar over a run outdoors before maghrib.",
        ),
      ],
    },
    {
      id: "tiredness",
      heading: "Why do I feel more tired in Ramadan?",
      blocks: [
        p(
          "One possible reason is that you sleep less, and at different times. A 2020 meta-analysis in Sleep and Breathing, pooling 24 studies, found average sleep fell from 7.2 hours a night before Ramadan to 6.4 hours during it, roughly an hour less. [3] Another review in the British Journal of Sports Medicine found that athletes who keep training at least twice a week during Ramadan sleep less than they did before it. [4]",
        ),
        p(
          "That is why the performance review recommends improving sleep and nutrition to avoid accumulating fatigue. [1] Practical advice compiled by researchers for active people includes avoiding a large late-night meal and taking a 20–30 minute daytime nap if you can. [5]",
        ),
      ],
    },
    {
      id: "weekly-routine",
      heading: "How should I adjust my weekly routine in Ramadan?",
      blocks: [
        p("Adjust intensity and timing, and keep the habit. Simple steps:"),
        steps(
          "Fix one slot for hard training, after iftar or after taraweeh.",
          "Keep pre-iftar activity light: walking, stretching, easy movement. The MOH suggests walking to the mosque for prayers. [9]",
          "Reduce the load when needed instead of skipping the session.",
          "Don't skip the warm-up and cool-down; a specialist quoted by the MOH recommends both to lower injury risk. [10]",
          "Protect your sleep as part of the programme. [3][5]",
          "Listen to your body: don't push it beyond what it can take, as the MOH puts it. [9]",
        ),
      ],
    },
    {
      id: "weight",
      heading: "Does Ramadan help with weight loss?",
      blocks: [
        p(
          "Weight may drop a little in Ramadan, but the change is usually temporary. A 2019 meta-analysis in Nutrients covering 70 studies (2,947 non-athlete participants) found reductions in weight and fat during Ramadan, larger in people who were overweight, along with a loss of fat-free mass smaller than the loss of fat, followed by a return towards pre-Ramadan values within 2–5 weeks after Ramadan. [8] What lasts after Ramadan is the habits you keep, not the month on its own.",
        ),
      ],
    },
    {
      id: "see-a-professional",
      heading: "When should you see a professional?",
      blocks: [
        list(
          "Before Ramadan: if you have a chronic condition such as diabetes, heart or kidney disease, or take regular medication, ask your doctor about fasting and exercise together. The MOH advises anyone with a health problem to consult their doctor before any physical activity. [9]",
          "During training: stop immediately if you feel severe dizziness, confusion, faintness or unusual palpitations.",
          "Heat illness: the MOH's first-aid guidance is to move the person somewhere cool, give sips of water if they are conscious, and call the Red Crescent if they lose consciousness. [9]",
        ),
        p(
          "This article is general education. It does not replace individual medical advice and does not address the religious rulings on fasting.",
        ),
      ],
    },
  ],
  sources: sourcesFor("en", SOURCES),
};
