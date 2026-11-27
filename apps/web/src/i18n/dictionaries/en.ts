import type { Dictionary } from "./ar";
import { cartEn } from "./cart-en";
import { checkoutEn } from "./checkout-en";
import { consentEn } from "./consent-en";
import { homeEn } from "./home-en";
import { landingEn } from "./landing-en";
import { paymentEn } from "./payment-en";
import { privacyEn } from "./privacy-en";

export const en: Dictionary = {
  currency: { SAR: "SAR" },
  months: { one: "month", two: "months", few: "months", many: "months" },
  days: { one: "1 day", two: "2 days", few: "days", many: "days" },
  club: {
    name: "Masters Way Sports Club",
    shortName: "Masters Way",
    logoAlt: "Masters Way Sports Club logo",
    slogan: "You've got this",
  },
  meta: {
    homeTitle: "Men's gym in Buraidah",
    homeDescription:
      "Masters Way Sports Club for men in Ar Rihab, Buraidah: strength floor, functional training, group classes, indoor pool, jacuzzi, sauna and steam room. Choose your duration and join.",
    membershipsTitle: "Memberships",
    membershipsDescription:
      "Masters Way memberships in Buraidah by duration and total price, with a clear comparison.",
    planDescription:
      "Membership details: duration, total price, what it covers, and the activation and freeze terms.",
  },
  nav: {
    skipToContent: "Skip to content",
    main: "Main navigation",
    mobile: "Mobile menu",
    menu: "Menu",
    home: "Home",
    about: "About",
    facilities: "Facilities",
    memberships: "Memberships",
    services: "Programs",
    contact: "Contact",
    join: "Join now",
    switchLanguage: "العربية",
  },
  staging: "Preview version: prices and content are for review and not final.",
  plans: {
    eyebrow: "Memberships",
    title: "Choose your duration",
    lead: "One total payment. Prices include VAT under the club's terms.",
    legend: "Membership duration",
    optionsLabel: "Membership durations",
    bestValue: "Best value",
    bonus: "+ {bonus} free",
    oneMonth: "1 month",
    durationBonus: "{total}, including {bonus} free",
    monthly: "About {amount} {unit} a month",
    freeze: "Freeze up to {days}",
    savings: "You pay about {monthly} a month instead of {reference} on {plan}",
    selection: "{plan}: {total}, {duration}",
    startsOnActivation: "Starts from activation at the club",
    includesAll: "Includes all club facilities",
    details: "Membership details",
    choose: "Choose",
    compare: "Compare memberships",
    emptyTitle: "No memberships are listed right now",
    emptyLead: "Message us on WhatsApp and we'll tell you what's available.",
    emptyAction: "Message us on WhatsApp",
  },
  payment: {
    eyebrow: "Payment",
    title: "Payment methods",
    methods: [
      { name: "mada", note: "mada card" },
      { name: "Apple Pay", note: "Pay from your phone" },
      { name: "Tabby", note: "Instalments, subject to Tabby approval" },
      { name: "Tamara", note: "Instalments, subject to Tamara approval" },
      { name: "Bank transfer", note: "Arranged with the club" },
    ],
    note: "Instalment amounts and count are set by the provider at checkout, and approval depends on eligibility.",
  },
  location: {
    directions: "Open the map",
    whatsapp: "WhatsApp",
    whatsappMessage: "Hello, I have a question about joining Masters Way.",
  },
  memberships: {
    title: "Memberships",
    intro: "Every membership covers all club facilities. Only duration and price differ.",
    compareEyebrow: "Compare",
    compareTitle: "Compare memberships",
    compareCaption: "Membership comparison by duration, price and benefits",
    rowPlan: "Membership",
    rowDuration: "Paid duration",
    rowBonus: "Free months",
    rowTotalDuration: "Total duration",
    rowPrice: "Total price",
    rowMonthly: "Approx. cost per month",
    included: "Included",
    notIncluded: "Not included",
    none: "None",
    allIncluded: "Every membership includes all facilities: {benefits}.",
  },
  plan: {
    back: "All memberships",
    includesTitle: "The membership includes",
    buyWhatsapp: "Join via WhatsApp",
    buyNote: "Online payment is being prepared. For now, you join through the club's WhatsApp.",
    buyOnline: "Buy now",
    whatsappAlternative: "Or join via WhatsApp",
    whatsappMessage: "Hello, I'd like to join with the “{plan}” membership.",
    stickyLabel: "Membership summary",
    priceLabel: "Total per person",
    termsEyebrow: "Before you join",
    termsTitle: "Membership terms",
    terms: {
      activation: {
        title: "Activation",
        line: "After you order, the club team contacts you to confirm it and arrange your activation.",
      },
      start: { title: "Start date", line: "The membership starts from activation at the club." },
      freeze: {
        title: "{freeze}",
        line: "{days} for every paid month. Ask the club before the freeze starts; free months don't count towards it.",
      },
      personal: {
        title: "Personal membership",
        line: "The price is per person, and nobody else may use the membership.",
      },
      age: { title: "Men", line: "Aged {age} and over." },
    },
  },
  quickBar: "Membership and contact shortcuts",
  photos: {
    functionalPress:
      "A man in a club shirt pressing a bar overhead in front of members in the functional area",
    legPress: "A member on the leg press machine on the strength floor",
    functionalSquat: "A group training with barbells on the green floor of the functional area",
    pool: "The indoor pool with the club logo on its wall",
    functionalFront:
      "A man in a club shirt squatting with a bar in front of members in the functional area",
    coachFloor: "A coach in a “COACH” shirt watching members in the functional area",
    latPulldown: "A member on the lat pulldown machine by the gym window",
    trainerPortrait: "A trainer in a club shirt, arms crossed, on the strength floor",
    consultation: "A man in a club jacket talking, seated by the pool's glass wall",
    sauna: "Hot sauna stones inside a wooden room at the club",
    coachTalk:
      "A man in a club shirt talking with members beside a loaded barbell in the functional area",
    benchRow:
      "A row of bench-press stations loaded with 20 kg plates before a yellow-and-black striped wall",
    functionalZone:
      "Members in the functional area: box jumps, a kettlebell swing and a barbell between yellow rigs",
    agilityFloor: "A green group-training floor set with cones, agility ladders, hoops and balls",
    machinesTurf: "Yellow weight machines on green turf beneath the runner mural",
    dumbbellRacks:
      "Long dumbbell racks on yellow stands with training benches on the strength floor",
  },
  footer: {
    tagline:
      "A men's sports club in Ar Rihab, Buraidah. Strength, classes, pool and sauna in one membership.",
    rights: "All rights reserved",
    pages: "Quick links",
    programs: "Programs",
    contact: "Contact",
    social: "Follow us",
    joinNote: "For now you join through the club's WhatsApp; online payment is being prepared.",
    /** أسماء شعارات طرق الدفع (نصها البديل)، بالترتيب في config/payment-marks.ts */
    paymentMarks: {
      mada: "mada",
      applePay: "Apple Pay",
      tabby: "Tabby",
      tamara: "Tamara",
      bank: "Bank transfer",
    },
    hours: "Club hours",
    socialNames: { instagram: "Instagram", x: "X", snapchat: "Snapchat", tiktok: "TikTok" },
  },
  notFound: {
    title: "Page not found",
    lead: "The link you opened is wrong or the page has moved.",
    home: "Back to home",
  },
  checkout: checkoutEn,
  cart: cartEn,
  ...homeEn,
  ...landingEn,
  error: {
    title: "The page couldn't load",
    lead: "Something went wrong on our side. Try again, and if it keeps happening, message us on WhatsApp.",
    retry: "Try again",
  },
  blog: {
    nav: "Blog",
    title: "Blog",
    intro:
      "Clear answers on choosing a membership, training and recovery. No article is published before a coach reviews it.",
    metaDescription:
      "Masters Way club articles on choosing a membership, training, recovery and nutrition, reviewed by a coach before publishing.",
    feedTitle: "{club} blog",
    topics: {
      choosing: {
        label: "Choosing a membership",
        lead: "Duration, price and what suits you before you pay.",
      },
      training: {
        label: "Training",
        lead: "How to start, how often to train and how to progress.",
      },
      recovery: { label: "Recovery", lead: "Pool, jacuzzi, steam and rest between sessions." },
      nutrition: {
        label: "Nutrition",
        lead: "Eating before and after training, with no medical promises.",
      },
    },
    draftBanner: "Draft awaiting the coach's review",
    draftNote: "Visible on the preview site only, and not published before review.",
    draftsNotice: "The articles here are drafts the coach has not reviewed yet.",
    draftsUpdated: "Drafts last updated: {date}.",
    published: "Published {date}",
    updated: "Updated {date}",
    reviewed: "Reviewed by {name} — {credential} — {date}",
    readingTime: "{minutes} read",
    minutes: { one: "1 min", two: "2 min", few: "min", many: "min" },
    breadcrumb: "Breadcrumb",
    summaryTitle: "The short answer",
    takeawaysTitle: "Key points",
    tocTitle: "In this article",
    sourcesTitle: "Sources",
    sourceLine: "{publisher}, {year}. Accessed {date}.",
    relatedTitle: "Read next",
    recommendationLabel: "Club membership now",
    recommendationTitle: "Lowest price per month: {plan}",
    recommendationAction: "Compare memberships",
  },
  tools: {
    footerLink: "Cost-per-visit calculator",
    costPerVisit: {
      metaTitle: "Cost-per-visit calculator",
      metaDescription:
        "Pick how often you train each week and see the approximate cost of one visit for each Masters Way membership in Buraidah.",
      title: "What does a visit cost?",
      lead: "Pick how many times you train each week, and we divide each membership's price by your visits over its full duration.",
      legend: "How many times a week do you train?",
      submit: "Calculate",
      resultTitle: "If you train {times} a week",
      times: { one: "once", two: "twice", few: "times", many: "times" },
      perVisit: "Approximate cost per visit",
      total: "Total price",
      approximate:
        "This is an estimate, rounded to the nearest riyal: a month counts as 52 ÷ 12 weeks, and we assume the same number of visits every week for the full duration, free months included. Prices are the memberships on sale now, VAT included.",
      membershipsLink: "What does one visit cost? Work it out",
    },
  },
  onlinePayment: paymentEn,
  consent: consentEn,
  privacy: privacyEn,
};
