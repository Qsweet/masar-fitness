import type { Dictionary } from "./ar";

export const consentEn: Dictionary["consent"] = {
  region: "Privacy settings",
  title: "Your privacy on our site",
  lead: "We use essential cookies so the site and cart work. Only with your consent, we use measurement and advertising tools from {providers} to learn what helps our visitors and to measure our ads.",
  acceptAll: "Accept all",
  rejectAll: "Essential only",
  customize: "Choose categories",
  save: "Save my choice",
  close: "Close",
  categoriesLegend: "Categories",
  categories: {
    necessary: {
      label: "Essential",
      hint: "Running the site, cart and checkout, remembering this choice, and noting which campaign brought you so we can measure it internally. Always on.",
    },
    analytics: { label: "Analytics", hint: "Visit counts and which pages help most." },
    ads: {
      label: "Advertising",
      hint: "Measuring our ads, and telling the ad platform about a purchase so it can link it to the ad.",
    },
  },
  privacyLink: "Privacy policy",
  settingsLink: "Privacy settings",
  providerNames: {
    gtm: "Google",
    ga4: "Google",
    google_ads: "Google",
    meta: "Meta",
    snap: "Snapchat",
    tiktok: "TikTok",
    x: "X",
    openai: "OpenAI",
  },
};
