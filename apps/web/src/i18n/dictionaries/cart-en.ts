import type { Dictionary } from "./ar";

/** نصوص السلة بالإنجليزية، بشكل القاموس العربي المرجع نفسه. */
export const cartEn: Dictionary["cart"] = {
  meta: { title: "Cart" },
  intro: {
    title: "Your cart",
    lead: "Review your membership and total, then complete your order. No payment at this step.",
  },
  link: { empty: "Cart, empty", one: "Cart, 1 item" },
  notes: {
    added: "The membership was added to your cart.",
    removed: "The membership was removed from your cart.",
    busy: "Too many attempts in a short time. Wait a moment and try again.",
    unavailable: "This membership is not available to buy right now.",
  },
  oneMembership: "The cart holds one membership; choosing another replaces it.",
  nextStep: "Optional add-ons and coupons come in the next step.",
  remove: "Remove",
  continue: "Complete your order",
  total: "Total",
  barLabel: "Cart total",
  empty: {
    title: "Your cart is empty",
    lead: "Choose your membership length to get started.",
    action: "Browse memberships",
  },
  help: "Need help? Message us on WhatsApp",
  helpMessage: "Hello, I need help completing my membership on the website.",
};
