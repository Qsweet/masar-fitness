import type { StaticImageData } from "next/image";
import c1Desktop from "./previews/c1-desktop.jpg";
import c1Mobile from "./previews/c1-mobile.jpg";
import c2Desktop from "./previews/c2-desktop.jpg";
import c2Mobile from "./previews/c2-mobile.jpg";
import c3Desktop from "./previews/c3-desktop.jpg";
import c3Mobile from "./previews/c3-mobile.jpg";

export interface ConceptSummary {
  readonly number: string;
  readonly href: string;
  readonly name: string;
  readonly nameLatin: string;
  readonly idea: string;
  readonly strengths: readonly string[];
  readonly commerce: string;
  readonly risk: string;
  readonly type: string;
  readonly colors: readonly { readonly name: string; readonly hex: string }[];
  readonly desktop: StaticImageData;
  readonly mobile: StaticImageData;
}

/** ملخص المفاهيم الثلاثة لصفحة المقارنة. اللقطات حقيقية من الصفحات نفسها (docs/design-lab/README.md). */
export const CONCEPTS: readonly ConceptSummary[] = [
  {
    number: "01",
    href: "/design-lab/concept-01",
    name: "الفخامة الرياضية",
    nameLatin: "Athletic Luxury",
    idea: "النادي ليلًا: صور حقيقية بقص سينمائي على أرضية فحمية، وعناوين رفيعة ضخمة، والكهرماني للفعل وحده.",
    strengths: [
      "أقوى انطباع أول: صورة الصالة كاملة الشاشة مع جدار «أنت قدها».",
      "الاشتراكات ألواح معمارية بأرقام مدة ضخمة، والإجمالي واضح تحتها.",
      "المسبح فصل سينمائي بلون المحيط العميق.",
    ],
    commerce: "يبني الرغبة أولًا ثم يعرض الباقات كمجموعة فاخرة. يناسب من يقارن الجودة قبل السعر.",
    risk: "قد يبدو أغلى من سعر النادي الفعلي لمن يبحث عن السعر أولًا.",
    type: "Alexandria (عناوين رفيعة) · IBM Plex Sans Arabic (نص)",
    colors: [
      { name: "فحم", hex: "#0C1014" },
      { name: "محيط عميق", hex: "#102B36" },
      { name: "عظمي", hex: "#F5F5F2" },
      { name: "كهرماني الشعار", hex: "#FCB800" },
    ],
    desktop: c1Desktop,
    mobile: c1Mobile,
  },
  {
    number: "02",
    href: "/design-lab/concept-02",
    name: "ثورة الأداء",
    nameLatin: "Performance Revolution",
    idea: "حملة رياضية شابة على أرضية فاتحة: شعار جدار النادي «أنت قدها» عنوانًا بحجم ملصق، وصور بالأبيض والأسود، والماء وحده بالألوان.",
    strengths: [
      "هوية لا تشبه أي نادٍ سعودي: الحافة المائلة مأخوذة من رسومات جدران النادي نفسه.",
      "الباقة الأوفر منتج بطل على كتلة صفراء، وبقية المدد تشكيلة واضحة بجانبها.",
      "نبرة سعودية قريبة من جمهور سناب شات.",
    ],
    commerce: "يدفع نحو باقة واحدة بوضوح شديد ويختصر قرار الشراء. الأقوى للإعلانات.",
    risk: "صاخب: قد لا يناسب من يبحث عن الهدوء والاستشفاء.",
    type: "Changa (عناوين ثقيلة مضغوطة) · Alexandria (نص)",
    colors: [
      { name: "ورق", hex: "#F5F5F2" },
      { name: "حبر", hex: "#0C1014" },
      { name: "كهرماني الشعار", hex: "#FCB800" },
      { name: "رمادي", hex: "#575F66" },
    ],
    desktop: c2Desktop,
    mobile: c2Mobile,
  },
  {
    number: "03",
    href: "/design-lab/concept-03",
    name: "تجارة اللياقة",
    nameLatin: "Fitness Commerce",
    idea: "الاشتراك منتج له صفحة شراء: سطح أبيض دافئ وخط دقيق، والمرافق كصور منتج، واختيار المدة يحدّث الملخص فورًا.",
    strengths: [
      "أسهل تجربة شراء: المدة والإجمالي وما يشمله والدفع في لوحة واحدة.",
      "الأوضح للمقارنة: اختيار بلمسة دون مغادرة الصفحة.",
      "الأخف على العين والأسرع في القراءة على الجوال.",
    ],
    commerce: "يعامل الاشتراك كمنتج استهلاكي راقٍ: أقل احتكاك من الاهتمام إلى الدفع.",
    risk: "أهدأ عاطفيًا؛ قوته في الوضوح لا في الإبهار.",
    type: "IBM Plex Sans Arabic (كل المستويات)",
    colors: [
      { name: "أبيض دافئ", hex: "#F5F5F2" },
      { name: "أبيض", hex: "#FFFFFF" },
      { name: "فحم", hex: "#0C1014" },
      { name: "كهرماني الشعار", hex: "#FCB800" },
    ],
    desktop: c3Desktop,
    mobile: c3Mobile,
  },
];
