import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { BidiText } from "./bidi-text";
import { Icon, type IconName } from "./icon";
import styles from "./photo-card.module.css";

interface PhotoCardProps {
  readonly id?: string | undefined;
  /** صورة من النادي */
  readonly photo: { readonly src: StaticImageData; readonly alt: string };
  readonly sizes: string;
  readonly title: string;
  readonly line: string;
  /** صف المعلومات أسفل البطاقة: معلومة بأيقونة في البداية، وشارة في النهاية */
  readonly meta: { readonly icon: IconName; readonly text: string };
  readonly badge?: string | undefined;
  /** تنبيه قصير تحت السطر (مثل «ليس علاجًا طبيعيًا») */
  readonly note?: string | undefined;
  readonly className?: string | undefined;
  /** ما يلي صف المعلومات: تفاصيل الأسعار وزر الاستفسار */
  readonly children?: ReactNode;
}

/** بطاقة بيضاء مستديرة بصورة في أعلاها، ثم العنوان والسطر، ثم صف المعلومات (المرافق والبرامج). */
export function PhotoCard(props: PhotoCardProps) {
  const { photo, meta } = props;
  return (
    <li id={props.id} className={cx("reveal", styles.card, props.className)}>
      <div className={styles.media}>
        <Image src={photo.src} alt={photo.alt} fill placeholder="blur" sizes={props.sizes} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{props.title}</h3>
        <p className={styles.line}>
          <BidiText text={props.line} />
        </p>
        {props.note === undefined ? null : <p className={styles.note}>{props.note}</p>}
        <p className={styles.meta}>
          <span className={styles.metaText}>
            <Icon name={meta.icon} />
            <BidiText text={meta.text} />
          </span>
          {props.badge === undefined ? null : <span className={styles.badge}>{props.badge}</span>}
        </p>
        {props.children}
      </div>
    </li>
  );
}
