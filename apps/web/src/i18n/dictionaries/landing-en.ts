import type { LandingDictionary } from "./landing-ar";

/** Hero, home sections and tab bar copy in English, mirroring the Arabic reference (decision 57). */
export const landingEn: LandingDictionary = {
  hero: {
    place: "Masters Way Sports Club · for men in Buraidah",
    title: "The strongest version of you",
    slogan: "starts here.",
    lead: "A complete training experience that makes a real difference to your fitness, your health and the way you live.",
    action: "Explore memberships",
    watch: "Watch the video",
    pause: "Pause the video",
    play: "Play the video",
    videoTitle: "A look inside a group class at the club",
    videoNote: "Silent footage from inside the club.",
    close: "Close",
    scroll: "Discover more",
    offerWith: "With the {term} membership",
  },
  highlights: {
    title: "What sets the club apart",
    items: [
      { title: "World-class equipment", line: "Life Fitness and Hammer Strength" },
      { title: "Certified coaches", line: "On the floor with you from day one" },
      { title: "Complete facilities", line: "Pool, jacuzzi, sauna and steam room" },
      { title: "Group classes", line: "HIIT, HYROX and Boot Camp" },
      { title: "A prime spot in Buraidah", line: "Ar Rihab, Northern Ring Road" },
    ],
  },
  goals: {
    eyebrow: "Start from your goal",
    title: "What is your fitness goal?",
    lead: "Pick your goal and we'll shape the right path for you.",
    more: "See the path",
    items: [
      { title: "Lose weight", line: "High-intensity group classes, and the pool after training." },
      {
        title: "Build muscle",
        line: "A strength floor with over {count} machines and free weights.",
      },
      { title: "Sports rehab", line: "A gradual return after injury, supervised by a specialist." },
      {
        title: "Get fitter",
        line: "Functional training for strength, endurance, speed and mobility.",
      },
    ],
  },
  stats: {
    title: "The club in numbers",
    founded: "Founded in Buraidah",
    rating: "The club's Google rating",
    reviews: "Google reviews",
    machines: "Machines on the strength floor",
    source: "Google rating and review count as shown on the club's website on {date}.",
  },
  tiers: {
    "three-months": "Champions' Start",
    "six-months": "The Change Path",
    "one-year": "Champions' Journey",
  },
  daily: "≈ {amount} {unit} a day",
  dailyNote: "The daily cost is approximate: the total over every day of the full term.",
  steps: {
    label: "Checkout steps",
    plan: "Choose a plan",
    details: "Your details",
    payment: "Payment",
    position: "Step {current} of {total}",
  },
  tabs: {
    label: "Quick navigation",
    home: "Home",
    memberships: "Memberships",
    services: "Services",
    blog: "Blog",
    whatsapp: "WhatsApp",
  },
};
