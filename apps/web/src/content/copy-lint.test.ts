import { describe, expect, it } from "vitest";
import { article, translation } from "@/test/blog-fixtures";
import { lintArticle, lintText, lintTree } from "./copy-lint";

function rules(text: string, locale: "ar" | "en" = "ar"): string[] {
  return lintText(text, locale).map((issue) => issue.rule);
}

describe("القواعد العربية", () => {
  it("الفاصلة والفاصلة المنقوطة والاستفهام العربية بين الكلمات العربية", () => {
    expect(rules("حديد, مسبح")).toEqual(["latin-punctuation"]);
    expect(rules("أولًا; ثانيًا")).toEqual(["latin-punctuation"]);
    expect(rules("كم مرة أتمرن?")).toEqual(["latin-punctuation"]);
    expect(rules("حديد، مسبح؛ كم مرة؟")).toEqual([]);
  });

  it("لا تخلط بين الفاصلة اللاتينية وفاصل الآلاف أو النص اللاتيني", () => {
    expect(rules("السعر 2,800 ر.س")).toEqual([]);
    expect(rules("مدى وApple Pay, تابي")).toContain("latin-touching-arabic");
    expect(rules("ادفع بـ Apple Pay, أو مدى")).not.toContain("latin-punctuation");
  });

  it("لا مسافة قبل علامة الترقيم ومسافة واحدة بعدها", () => {
    expect(rules("حديد ، مسبح")).toEqual(["space-before-punctuation"]);
    expect(rules("حديد،مسبح")).toEqual(["missing-space-after"]);
    expect(rules("انتهى.وبدأ")).toEqual(["missing-space-after"]);
    expect(rules("حديد،  مسبح")).toEqual(["double-space"]);
    expect(rules("قال «كم؟» ومضى")).toEqual([]);
  });

  it("لا مسافة مزدوجة ولا مسافة في الطرفين", () => {
    expect(rules("نادي  رياضي")).toEqual(["double-space"]);
    expect(rules(" نادي")).toEqual(["edge-space"]);
    expect(rules("نادي ")).toEqual(["edge-space"]);
  });

  it("لا تطويل ولا أرقام هندية (الأرقام لاتينية، القرار 15)", () => {
    expect(rules("مســار")).toEqual(["tatweel", "tatweel"]);
    expect(rules("12 شهرًا و٢ مجانًا")).toEqual(["arabic-indic-digits"]);
    expect(rules("٣ أشهر")).toEqual(["arabic-indic-digits"]);
  });

  it("علامات الاقتباس والأقواس متوازنة", () => {
    expect(rules("«أنت قدها")).toEqual(["unbalanced-pair"]);
    expect(rules("(حديد")).toEqual(["unbalanced-pair"]);
    expect(rules("«أنت (قدها»)")).toEqual(["unbalanced-pair"]);
    expect(rules("«أنت قدها» (على الجدار)")).toEqual([]);
  });

  it("حرف لاتيني ملاصق لحرف عربي، والنقاط الثلاث بدل «…»", () => {
    expect(rules("جدارBE STRONG")).toEqual(["latin-touching-arabic"]);
    expect(rules("جدار BE STRONG")).toEqual([]);
    expect(rules("وغيرها...")).toEqual(["ascii-ellipsis"]);
    expect(rules("وغيرها…")).toEqual([]);
  });

  it("الاستثناءات المعلنة: الروابط والعناصر النائبة و«ر.س»", () => {
    expect(rules("زر https://wa.me/966553240111?text=a,b للتواصل")).toEqual([]);
    expect(rules("حوالي {amount} {unit} للشهر")).toEqual([]);
    expect(rules("«{plan}»")).toEqual([]);
    expect(rules("200 ر.س")).toEqual([]);
  });

  it("المقتطف يُظهر النص المخالف من الأصل", () => {
    const [issue] = lintText("نادي رياضي في بريدة, حي الرحاب", "ar");
    expect(issue?.excerpt).toContain("بريدة, حي");
  });
});

describe("القواعد الإنجليزية", () => {
  it("لا مسافة مزدوجة ولا مسافة قبل الترقيم", () => {
    expect(rules("Choose  your plan", "en")).toEqual(["double-space"]);
    expect(rules("Hello , there", "en")).toEqual(["space-before-punctuation"]);
    expect(rules("Done !", "en")).toEqual(["space-before-punctuation"]);
    expect(rules("You've got this.", "en")).toEqual([]);
  });

  it("الاقتباس من نوع واحد في النص الواحد", () => {
    expect(rules('the “BE STRONG" wall', "en")).toContain("inconsistent-quotes");
    expect(rules("You've got the “BE STRONG” wall’s", "en")).toEqual(["inconsistent-quotes"]);
    expect(rules('the "BE STRONG" wall', "en")).toEqual([]);
    expect(rules("I'd like the “{plan}” membership", "en")).toEqual([]);
    expect(rules("the “BE STRONG wall", "en")).toEqual(["unbalanced-pair"]);
  });

  it("الإنجليزية لا تُفحص بقواعد العربية", () => {
    expect(rules("pay, then train?", "en")).toEqual([]);
  });
});

describe("المواضع", () => {
  it("مسار المفتاح في القاموس", () => {
    const tree = { payment: { methods: [{ note: "حديد ، مسبح" }] } };
    expect(lintTree(tree, "ar")).toEqual([
      expect.objectContaining({
        where: "payment.methods[0].note",
        rule: "space-before-punctuation",
      }),
    ]);
  });

  it("معرّف المقال ولغته وقسمه، والفقرة تُقرأ متصلة بمقاطعها", () => {
    expect(lintArticle(article())).toEqual([]);
    const bad = translation({
      sections: [
        {
          id: "how-often",
          heading: "كم مرة?",
          blocks: [{ type: "list", items: ["حديد  ومسبح"] }],
        },
      ],
    });
    const violations = lintArticle(article({ translations: { ar: bad } }));
    expect(violations.map((v) => `${v.where}: ${v.rule}`)).toEqual([
      "how-often-to-train [ar] #how-often heading: latin-punctuation",
      "how-often-to-train [ar] #how-often: double-space",
    ]);
  });
});
