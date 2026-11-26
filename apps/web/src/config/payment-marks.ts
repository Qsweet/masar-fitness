import applePay from "@/assets/payments/apple-pay.svg";
import mada from "@/assets/payments/mada.svg";
import tabby from "@/assets/payments/tabby.svg";
import tamara from "@/assets/payments/tamara.svg";

/**
 * شعارات طرق الدفع التي يقبلها النادي (docs/CLUB_FACTS.md: مدى، Apple Pay، تابي، تمارا، تحويل بنكي)،
 * من ملفات الجهات الرسمية بلا تعديل في الرسم (القرار 60): Apple Pay Mark من developer.apple.com،
 * وشعارا تابي وتمارا من موقعيهما، وشعار مدى المنشور. التحويل البنكي بلا شعار: أيقونة واسمه.
 */
export const PAYMENT_MARKS = [
  { id: "mada", logo: mada },
  { id: "applePay", logo: applePay },
  { id: "tabby", logo: tabby },
  { id: "tamara", logo: tamara },
] as const;
