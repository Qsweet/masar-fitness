import type { Dictionary } from "./ar";

/** نصوص مسار الشراء بالإنجليزية، بشكل القاموس العربي المرجع نفسه. */
export const checkoutEn: Dictionary["checkout"] = {
  meta: { title: "Complete your order", orderTitle: "Order review" },
  backToPlan: "Back to the membership",
  intro: {
    title: "Complete your order",
    lead: "Review the summary, then enter your name and mobile to reserve the order. No payment at this step.",
  },
  summary: {
    title: "Order summary",
    subtotal: "Subtotal before discount",
    discount: "Discount",
    total: "Total incl. VAT",
    vat: "Includes VAT {rate}%",
    couponDiscount: "Coupon {code}",
    startRule: {
      on_payment: "The membership starts on the day of payment.",
      on_first_visit: "The membership starts on your first visit to the club after payment.",
    },
    couponNotCombinable:
      "Your coupon is valid, but the current offer saves you more, so only the offer was applied.",
    eligibilityAtConfirm: "Offer eligibility is checked when you confirm.",
  },
  options: {
    title: "Add-ons and coupon",
    addonsLegend: "Optional add-ons",
    coupon: "Discount coupon",
    couponHint: "Optional. Leave it empty if you don't have one.",
    apply: "Update summary",
    fixCoupon: "Fix or remove the coupon, then update the summary to continue.",
  },
  form: {
    title: "Your details",
    lead: "We reserve the order under your name and mobile, and contact you on it.",
    name: "Name",
    mobile: "Mobile number",
    mobileHint: "Saudi mobile, e.g. 05XXXXXXXX",
    total: "Total on confirmation",
    submit: "Confirm order",
    pending: "Confirming your order…",
    errorSummary: "Please review the following, then confirm again:",
    priceChanged:
      "The order total has changed. Check the new total next to the button, then confirm again.",
    dataChanged: "Your details changed since the last attempt. Review them, then confirm again.",
    whatsappInstead: "Message us on WhatsApp",
    plansInstead: "Choose another membership",
  },
  unavailable: {
    title: "Online purchase isn't available right now",
    lead: "We can't complete this order on the website at the moment. Message us on WhatsApp and we'll complete your membership with you.",
    action: "Subscribe on WhatsApp",
    problemTitle: "We couldn't prepare the order",
    restart: "Start again",
  },
  review: {
    pendingTitle: "Your order is reserved",
    pendingLead: "Keep your order number. We'll complete the payment with you on WhatsApp.",
    expiredTitle: "This order has expired",
    expiredLead:
      "The order wasn't paid before its deadline. Start a new order at the current prices.",
    paidTitle: "Your order is paid",
    paidLead: "Thank you. Message us on WhatsApp with your order number for any question.",
    closedTitle: "This order is closed",
    closedLead: "Message us on WhatsApp with your order number for any question.",
    reference: "Order number",
    buyer: "Buyer details",
    name: "Name",
    mobile: "Mobile",
    status: "Order status",
    statuses: {
      pending: "Awaiting payment",
      paid: "Paid",
      expired: "Expired",
      closed: "Closed",
    },
    expiresAt: "The payment deadline is {time}, club time.",
    lines: "Order details",
    includes: "Includes",
    nextTitle: "Next step",
    paymentUnavailable:
      "Online payment isn't available yet. Send your order number on WhatsApp and we'll complete the payment with you before the deadline.",
    whatsapp: "Send the order number on WhatsApp",
    whatsappMessage: "Hello, I'd like to complete the payment for my order {reference}.",
    startAgain: "Start a new order",
  },
  errors: {
    "buyer.name_too_short": "Enter your name, at least two letters.",
    "buyer.name_too_long": "The name is longer than allowed. Shorten it.",
    "buyer.name_invalid": "Enter your name using letters.",
    "mobile.invalid_characters": "Use digits only for the mobile number, e.g. 05XXXXXXXX.",
    "mobile.not_saudi_mobile": "Enter a valid Saudi mobile number, e.g. 05XXXXXXXX.",
    "coupon.invalid_format": "Invalid coupon format: English letters and digits only.",
    "coupon.rejected": "This coupon can't be used for this order. Check it or remove it.",
    "coupon.throttled":
      "We couldn't check the coupon right now because of too many attempts. Wait a little and try again, or remove it to continue.",
    "promotion.ended": "This coupon has expired.",
    "promotion.exhausted": "This coupon has no uses left.",
    "promotion.customer_limit_reached":
      "You've already used this coupon the allowed number of times.",
    "promotion.audience_mismatch": "This coupon isn't available to you.",
    "promotion.audience_unverified":
      "Your eligibility for this coupon is checked when you confirm.",
    "promotion.not_applicable": "This coupon doesn't apply to this order.",
    "cart.product_unavailable": "This membership or one of its add-ons is no longer for sale.",
    "cart.addon_not_attachable": "One of the add-ons can't be added to this membership.",
    "cart.addon_duplicate": "You chose the same add-on more than once.",
    "cart.too_many_addons": "Too many add-ons for one order.",
    "cart.addon_requires_membership": "Add-ons can only be bought with a membership.",
    "cart.zero_total": "An order can't have a zero total.",
    "cart.amount_out_of_range": "The order total is outside the allowed range.",
    "order.too_many_pending":
      "You have orders awaiting payment. Complete them first or message us on WhatsApp.",
    "checkout.throttled":
      "Too many attempts in a short time. Wait a few minutes and try again, or message us on WhatsApp.",
    "policy.undecided":
      "Online purchase isn't available for this order right now. Message us on WhatsApp.",
    "form.invalid": "We couldn't read the form. Refresh the page and try again.",
    "form.generic": "We couldn't complete the order. Try again or message us on WhatsApp.",
  },
};
