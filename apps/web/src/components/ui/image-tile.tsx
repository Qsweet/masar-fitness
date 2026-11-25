import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { BidiText } from "./bidi-text";
import { Icon, type IconName } from "./icon";
import styles from "./image-tile.module.css";

interface ImageTileProps {
  readonly id?: string | undefined;
  readonly photo: { readonly src: StaticImageData; readonly alt: string };
  readonly sizes: string;
  readonly title: string;
  readonly line: string;
  /** معلومة صغيرة بأيقونة تحت السطر */
  readonly meta?: { readonly icon: IconName; readonly text: string } | undefined;
  /** شارة في أعلى البطاقة */
  readonly badge?: string | undefined;
  /** البطاقة كلها رابط، و«المزيد» نص ظاهر بسهم */
  readonly link?: { readonly href: string; readonly label: string } | undefined;
  readonly className?: string | undefined;
}

function Caption(props: ImageTileProps) {
  return (
    <div className={styles.caption}>
      <h3 className={styles.title}>{props.title}</h3>
      <p className={styles.line}>
        <BidiText text={props.line} />
      </p>
      {props.meta === undefined ? null : (
        <p className={styles.meta}>
          <Icon name={props.meta.icon} />
          <BidiText text={props.meta.text} />
        </p>
      )}
      {props.link === undefined ? null : (
        <span className={styles.more}>
          {props.link.label}
          <Icon name="arrow" />
        </span>
      )}
    </div>
  );
}

/**
 * بطاقة صورة كاملة من النادي بتظليل أسود في أسفلها والعنوان والسطر فوقه (المرافق والأهداف).
 * بحد رفيع وزوايا واسعة، والصورة تتقرّب قليلًا عند التحويم. مع رابط تصير البطاقة كلها رابطًا.
 */
export function ImageTile(props: ImageTileProps) {
  const body = (
    <>
      <Image
        src={props.photo.src}
        alt={props.photo.alt}
        fill
        placeholder="blur"
        sizes={props.sizes}
        className={styles.image}
      />
      <span className={styles.scrim} aria-hidden="true" />
      {props.badge === undefined ? null : <span className={styles.badge}>{props.badge}</span>}
      <Caption {...props} />
    </>
  );
  return (
    <li id={props.id} className={cx("reveal", styles.tile, props.className)}>
      {props.link === undefined ? (
        <div className={styles.frame}>{body}</div>
      ) : (
        <Link href={props.link.href} className={styles.frame}>
          {body}
        </Link>
      )}
    </li>
  );
}
