import type { Dictionary } from "./ar";

export const privacyEn: Dictionary["privacy"] = {
  meta: {
    title: "Privacy policy",
    description:
      "What the club's website collects and why, which parties receive measurement data with your consent, and how to change your choice.",
  },
  title: "Privacy policy",
  lead: "What this website collects and why, and how you control it.",
  providers: ["Google", "Meta", "Snapchat", "TikTok", "X", "OpenAI"],
  sections: [
    {
      heading: "What we collect when you buy",
      body: "Your name and mobile number to complete your order and contact you about it, and the order and payment record because it is a financial record. We never store your card details: payment happens on the payment provider's page.",
    },
    {
      heading: "Essential cookies",
      body: "Small files that keep your cart, your choice in the privacy bar, and the campaign or ad that brought you, so we can measure our campaigns in our own records. They are always on because the site cannot work without them.",
    },
    {
      heading: "Analytics and advertising, with your consent",
      body: "When you consent, the measurement and advertising tools the club has turned on from {providers} are loaded. Without your consent none of them load. These parties process data on their own servers, some outside Saudi Arabia.",
    },
    {
      heading: "What ad platforms receive when you buy",
      body: "If you accepted advertising, we tell the platform that you bought, the order value and the membership code, together with your mobile number converted to a SHA-256 code as the platform requires to link the purchase to the ad. We never send the number itself, and we send none of this without your consent.",
    },
    {
      heading: "Changing your choice",
      body: "Use the “Privacy settings” link at the bottom of every page, at any time. Withdrawing consent stops the tools from the next page.",
    },
    {
      heading: "Questions",
      body: "Message us on the club's WhatsApp or email, shown at the bottom of the page.",
    },
  ],
};
