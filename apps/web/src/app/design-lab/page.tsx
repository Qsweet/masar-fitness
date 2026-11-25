import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CONCEPTS, type ConceptSummary } from "@/design-lab/concepts";
import { DEMO_PRICE_NOTE } from "@/design-lab/facts";
import { Logo } from "@/design-lab/logo";
import styles from "@/design-lab/index.module.css";

export const metadata: Metadata = { title: { absolute: "مختبر التصميم | مسار الأبطال" } };

const LOGO_HEIGHT = 56;

function Concept({ concept }: { readonly concept: ConceptSummary }) {
  return (
    <article className={styles.concept} aria-labelledby={`concept-${concept.number}`}>
      <div className={styles.conceptText}>
        <p className={styles.number}>{concept.number}</p>
        <h2 id={`concept-${concept.number}`} className={styles.name}>
          {concept.name} <span lang="en">{concept.nameLatin}</span>
        </h2>
        <p>{concept.idea}</p>
        <h3 className={styles.label}>نقاط القوة</h3>
        <ul className={styles.list}>
          {concept.strengths.map((strength) => (
            <li key={strength}>{strength}</li>
          ))}
        </ul>
        <h3 className={styles.label}>النهج التجاري</h3>
        <p>{concept.commerce}</p>
        <h3 className={styles.label}>المخاطرة</h3>
        <p>{concept.risk}</p>
        <h3 className={styles.label}>الخط والألوان</h3>
        <p className={styles.type}>{concept.type}</p>
        <ul className={styles.swatches}>
          {concept.colors.map((color) => (
            <li key={color.hex}>
              <span
                className={styles.swatch}
                style={{ background: color.hex }}
                aria-hidden="true"
              />
              {color.name} <span dir="ltr">{color.hex}</span>
            </li>
          ))}
        </ul>
        <Link href={concept.href} className={styles.open}>
          افتح المفهوم {concept.number}
        </Link>
      </div>
      <div className={styles.shots}>
        <figure className={styles.desktop}>
          <Image
            src={concept.desktop}
            alt={`الشاشة الأولى للمفهوم ${concept.number} على الحاسب`}
            sizes="(min-width: 64rem) 45vw, 100vw"
          />
          <figcaption>حاسب 1440</figcaption>
        </figure>
        <figure className={styles.mobile}>
          <Image
            src={concept.mobile}
            alt={`الشاشة الأولى للمفهوم ${concept.number} على الجوال`}
            sizes="(min-width: 64rem) 14vw, 40vw"
          />
          <figcaption>جوال 390</figcaption>
        </figure>
      </div>
    </article>
  );
}

/** صفحة مقارنة المفاهيم للمالك: لا تختار نيابة عنه. */
export default function DesignLabIndex() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo height={LOGO_HEIGHT} preload />
        <div>
          <h1 className={styles.title}>مختبر التصميم</h1>
          <p className={styles.lead}>
            ثلاثة اتجاهات مختلفة جذريًا للصفحة الرئيسية، مبنية بصور النادي الحقيقية وبيانات الباقات
            من قاعدة الموقع. افتح كل مفهوم على الجوال والحاسب، ثم اختر الاتجاه الذي يُبنى عليه
            الموقع كاملًا.
          </p>
          <p className={styles.note}>
            معزول عن الموقع ومغلق عن محركات البحث. {DEMO_PRICE_NOTE} مواضع صور الجاكوزي والبخار
            معلَّمة لأن صورها لم تصل بعد.
          </p>
        </div>
      </header>
      <main className={styles.main}>
        {CONCEPTS.map((concept) => (
          <Concept key={concept.number} concept={concept} />
        ))}
      </main>
    </div>
  );
}
