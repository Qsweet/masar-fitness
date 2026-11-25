import Image, { type StaticImageData } from "next/image";
import styles from "./photo-backdrop.module.css";

/**
 * صورة خلفية زخرفية (alt فارغ) تملأ حاويتها الموضوعة خلف تظليل أسود من جهة النص، لرؤوس الصفحات
 * المصوَّرة. الحاوية تحتاج position: relative وisolation: isolate. تُحمَّل أولًا لأنها في أعلى الصفحة.
 */
export function PhotoBackdrop({ photo }: { readonly photo: StaticImageData }) {
  return (
    <>
      <Image
        className={styles.photo}
        src={photo}
        alt=""
        fill
        preload
        placeholder="blur"
        sizes="100vw"
      />
      <div className={styles.scrim} aria-hidden="true" />
    </>
  );
}
