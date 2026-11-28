import type { SettingValues } from "@masar/domain";

/**
 * نصا الشروط والأحكام وسياسة الاسترجاع كما ظهرا في الموقع القديم (آخر تحديث فيه: سبتمبر 2026)، **مسودةً
 * غير منشورة**: الصفحتان تردّان 404 حتى يراجع النص مختص قانوني ويفعّل المالك النشر من اللوحة. صُحِّح
 * العنوان إلى «الطريق الدائري الغربي» المؤكد؛ وما عداه بنصه، ومنه ما يحتاج تأكيد المالك (جدول التجميد
 * وباقة 9 أشهر، التقسيط، شمول الضريبة، حجز عرض الأصدقاء). الترجمة الإنجليزية مسودة كذلك.
 */
const section = (heading: readonly [string, string], body: readonly [string, string]) => ({
  heading: { ar: heading[0], en: heading[1] },
  body: { ar: body[0], en: body[1] },
});

const FREEZE_AR =
  "اشتراك 3 أشهر: 15 يومًا.\nاشتراك 6 أشهر: 30 يومًا.\nاشتراك 9 أشهر: 45 يومًا.\nاشتراك 12 شهرًا: 60 يومًا.";
const FREEZE_EN =
  "3-month membership: 15 days.\n6-month membership: 30 days.\n9-month membership: 45 days.\n12-month membership: 60 days.";

const TERMS_SECTIONS = [
  section(
    ["الخدمة", "The service"],
    [
      "يقدّم نادي مسار الأبطال (بريدة، حي الرحاب، الطريق الدائري الغربي) اشتراكات رياضية للرجال تشمل صالة الحديد واللياقة والحصص الجماعية، مع المسبح والجاكوزي والساونا والبخار ضمن الاشتراك، إضافة إلى برامج مثل التدريب الشخصي وتعليم السباحة للكبار وتأهيل الإصابات الرياضية حسب الباقة.",
      "Masar Al-Abtal (Buraidah, Ar Rihab, Western Ring Road) offers fitness memberships for men covering the weights hall, fitness and group classes, with the pool, jacuzzi, sauna and steam room included, plus programmes such as personal training, adult swimming lessons and sports injury rehabilitation, depending on the package.",
    ],
  ),
  section(
    ["استخدام الموقع", "Using the website"],
    [
      "يلتزم المستخدم باستخدام الموقع بطريقة مشروعة، ويُمنع:\nنسخ محتوى الموقع أو إعادة نشره دون إذن مسبق.\nاستخدام الموقع لأي غرض غير نظامي.\nمحاولة الوصول غير المصرّح به إلى أنظمة الموقع أو بياناته.\nاستخدام اسم النادي أو شعاره أو هويته دون موافقة كتابية.",
      "You agree to use the website lawfully. The following are prohibited:\nCopying or republishing the website content without prior permission.\nUsing the website for any unlawful purpose.\nAttempting unauthorised access to the website systems or data.\nUsing the club name, logo or identity without written consent.",
    ],
  ),
  section(
    ["الاشتراكات", "Memberships"],
    [
      "تفاصيل كل باقة (المدة، المزايا، الأشهر المجانية، مدة التجميد) موضحة في صفحتها، وعلى المشترك مراجعتها قبل الدفع.\nالاشتراك شخصي ولا يجوز استخدامه من شخص آخر. وباقات «الشلة» تتطلب 3 أشخاص وتُحجز عبر واتساب.\nيبدأ الاشتراك من تاريخ التفعيل في النادي.",
      "The details of each package (duration, benefits, free months, freeze allowance) are shown on its page, and you should review them before paying.\nA membership is personal and may not be used by anyone else. Group packages require 3 people and are booked through WhatsApp.\nThe membership starts on the date it is activated at the club.",
    ],
  ),
  section(
    ["تجميد الاشتراك", "Freezing a membership"],
    [
      `${FREEZE_AR}\nيُطلب التجميد من إدارة النادي قبل بدايته، ولا تُحتسب الأشهر المجانية ضمن مدة التجميد.`,
      `${FREEZE_EN}\nA freeze must be requested from the club management before it starts, and free months do not count towards the freeze allowance.`,
    ],
  ),
  section(
    ["الأسعار والدفع", "Prices and payment"],
    [
      "الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة ما لم يُذكر خلاف ذلك.\nالدفع عبر وسائل الدفع المعتمدة في المتجر، ومنها التقسيط عبر تمارا وتابي وفق شروطهما.\nالعروض الترويجية صالحة حتى تاريخها المعلن فقط.",
      "Prices are in Saudi riyals and include VAT unless stated otherwise.\nPayment is made through the payment methods accepted in the store, including instalments through Tamara and Tabby under their terms.\nPromotional offers are valid only until their announced date.",
    ],
  ),
  section(
    ["الملكية الفكرية", "Intellectual property"],
    [
      "جميع النصوص والصور والتصاميم والشعارات والمواد المرئية على الموقع ملك لنادي مسار الأبطال، ولا يجوز استخدامها دون موافقة كتابية مسبقة.",
      "All text, images, designs, logos and visual material on the website belong to Masar Al-Abtal and may not be used without prior written consent.",
    ],
  ),
  section(
    ["اللياقة الصحية", "Fitness to exercise"],
    [
      "يقرّ المشترك بأنه لائق صحيًا لممارسة الرياضة، وبأن أي معلومات صحية يقدمها صحيحة. ويحق للنادي إيقاف الخدمة مؤقتًا إذا تبيّن وجود حالة قد تشكل خطرًا على المشترك أو غيره، مع التواصل معه لإيجاد الحل المناسب.",
      "You confirm that you are medically fit to exercise and that any health information you provide is accurate. The club may suspend the service temporarily if a condition appears that could endanger you or others, and will contact you to find a suitable solution.",
    ],
  ),
  section(
    ["تعليق العضوية", "Suspension of membership"],
    [
      "يحق للنادي تعليق العضوية أو إلغاؤها في حال: مخالفة أنظمة النادي، أو إساءة استخدام المرافق، أو الإضرار بالممتلكات أو بالأعضاء أو العاملين، أو تقديم معلومات غير صحيحة.",
      "The club may suspend or cancel a membership for: breaching the club rules, misusing the facilities, harming property, members or staff, or providing false information.",
    ],
  ),
  section(
    ["حدود المسؤولية", "Limitation of liability"],
    [
      "لا يتحمل النادي مسؤولية الأضرار الناتجة عن إدخال بيانات غير صحيحة من المستخدم، أو سوء استخدام الخدمات، أو الأعطال والظروف الخارجة عن إرادته.",
      "The club is not liable for damage resulting from incorrect data entered by the user, misuse of the services, or faults and circumstances beyond its control.",
    ],
  ),
  section(
    ["التواصل", "Contact"],
    [
      "لأي استفسار: واتساب النادي أو قسم «تواصل معنا» في الموقع.",
      "For any enquiry: the club's WhatsApp or the “Contact us” section of the website.",
    ],
  ),
  section(
    ["تعديل الشروط", "Changes to these terms"],
    [
      "يحق للنادي تحديث هذه الشروط، ويُعمل بالنسخة المنشورة على الموقع وقت الشراء.",
      "The club may update these terms. The version published on the website at the time of purchase applies.",
    ],
  ),
];

export const TERMS_DEFAULT: SettingValues["legal.terms"] = {
  published: false,
  reviewed: false,
  updatedOn: "",
  intro: {
    ar: "مرحبًا بك في موقع نادي مسار الأبطال الرياضي. نرجو قراءة هذه الشروط بعناية قبل استخدام الموقع أو شراء أي اشتراك. استخدامك للموقع أو إتمامك لأي عملية شراء يعني موافقتك على هذه الشروط وعلى سياسة الخصوصية وسياسة الاسترجاع، وفق الأنظمة المعمول بها في المملكة العربية السعودية.",
    en: "Welcome to the Masar Al-Abtal website. Please read these terms carefully before using the website or buying a membership. Using the website or completing a purchase means you accept these terms, the privacy policy and the returns policy, under the laws of the Kingdom of Saudi Arabia.",
  },
  sections: TERMS_SECTIONS,
};

export const RETURNS_DEFAULT: SettingValues["legal.returns"] = {
  published: false,
  reviewed: false,
  updatedOn: "",
  intro: {
    ar: "نلتزم في نادي مسار الأبطال بتجربة اشتراك واضحة. هذه سياسة الاشتراكات المشتراة عبر الموقع.",
    en: "At Masar Al-Abtal we are committed to a clear membership experience. This policy covers memberships bought through the website.",
  },
  sections: [
    section(
      ["البدائل المتاحة لك", "Your options"],
      [
        `تجميد الاشتراك حسب الباقة:\n${FREEZE_AR}\nترقية الاشتراك إلى باقة أطول بدفع الفرق فقط.`,
        `Freezing the membership, depending on the package:\n${FREEZE_EN}\nUpgrading to a longer package by paying the difference only.`,
      ],
    ),
    section(
      ["الأخطاء في الدفع", "Payment errors"],
      [
        "إذا خُصم المبلغ مرتين أو خُصم مبلغ زائد بسبب خطأ تقني، نعيد المبلغ الزائد بعد التحقق من العملية.",
        "If you are charged twice or overcharged because of a technical error, we refund the excess amount after verifying the transaction.",
      ],
    ),
    section(
      ["التواصل", "Contact"],
      [
        "لأي طلب تجميد أو ترقية: واتساب النادي.",
        "For any freeze or upgrade request: the club's WhatsApp.",
      ],
    ),
  ],
};
