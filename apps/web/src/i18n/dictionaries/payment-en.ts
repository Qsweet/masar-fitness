import type { Dictionary } from "./ar";

/** English payment texts. Follows the Arabic reference shape. */
export const paymentEn: Dictionary["onlinePayment"] = {
  providerDescription: "Masters Way Sports Club, order {reference}",
  headline: {
    payLead: "Keep your order number and complete the payment before the deadline.",
    verifyingTitle: "We are checking your payment",
    verifyingLead:
      "We have not received the final result from the payment provider yet. Do not pay again; refresh the status shortly.",
    reviewTitle: "Your payment is under review",
    reviewLead: "A payment on this order needs a review by the club team. Do not pay again.",
  },
  statuses: {
    verifying: "Checking payment",
    review: "Under review",
  },
  panel: {
    title: "Payment",
    payLead:
      "You will move to the payment provider's page to enter your payment details. Your card details never pass through our servers.",
    pay: "Pay now",
    retryNotice: "The previous payment attempt was not completed. You can try again.",
    resumeLead:
      "You started the payment and it is not complete yet. Finish it on the provider's page, or refresh the status if you have paid.",
    resume: "Continue payment",
    refresh: "Refresh payment status",
    verifyingLead:
      "We are checking the payment status with the provider. This can take a few minutes.",
    reviewLead: "Send your order number on WhatsApp so we can review the payment with you.",
    whatsapp: "Send the order number on WhatsApp",
    whatsappMessage: "Hello, I need a payment review for my order {reference}.",
    notices: {
      failed:
        "We could not open the payment page right now. Try again shortly, or message us on WhatsApp.",
      throttled: "Too many attempts in a short time. Wait a few minutes, then try again.",
    },
    demoNotice: "Demo mode: payment here is a simulation and no amount is charged.",
  },
  demo: {
    metaTitle: "Demo payment page",
    title: "Demo payment page",
    lead: "A simulation of the payment provider's page, for testing only. Do not enter card details; no amount is charged.",
    summary: "Demo payment",
    reference: "Order number",
    amount: "Amount",
    outcomesTitle: "Choose the simulated result",
    outcomes: {
      paid: "Successful payment",
      failed: "Failed payment",
      mismatch: "Payment with a different amount",
      pending: "Payment left pending",
    },
    back: "Go back without paying",
    closed: "This demo session has ended. Go back to your order.",
  },
};
