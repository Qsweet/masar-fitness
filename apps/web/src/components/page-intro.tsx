import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./page-intro.module.css";

interface PageIntroProps {
  readonly title: string;
  readonly lead: string;
  /** عنصر فوق العنوان، مثل رابط الرجوع. */
  readonly before?: ReactNode;
  /** عناصر بعد السطر التعريفي، مثل تواريخ المقال ومراجعه. */
  readonly children?: ReactNode;
  /** «poster» للعناوين القصيرة (الافتراضي)، و«article» لعنوان مقال طويل: أصغر ومتباعد الأسطر. */
  readonly size?: "poster" | "article";
  /** صورة من النادي بجانب العنوان على الشاشة الواسعة (لا تظهر على الجوال). */
  readonly photo?: { readonly src: StaticImageData; readonly alt: string };
}

/** معرّف رأس الصفحة: شريط الشراء الثابت يظهر بعد أن يغادر الشاشة. */
export const INTRO_ID = "top";

/** رأس الصفحات الداخلية: عنوان واضح وسطر واحد، وصورة اختيارية، وما يليه مباشرة هو المحتوى. */
export function PageIntro({
  title,
  lead,
  before,
  children,
  size = "poster",
  photo,
}: PageIntroProps) {
  return (
    <section id={INTRO_ID} className={cx(styles.intro, photo !== undefined && styles.withPhoto)}>
      <div className={cx("container", styles.inner)}>
        <div className={styles.text}>
          {before === undefined ? null : <div className={styles.before}>{before}</div>}
          <h1 className={cx(styles.title, size === "article" && styles.articleTitle)}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {children}
        </div>
        {photo === undefined ? null : (
          <figure className={styles.photo}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              preload
              placeholder="blur"
              sizes="(min-width: 64rem) 45vw, 1px"
            />
          </figure>
        )}
      </div>
    </section>
  );
}
