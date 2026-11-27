import Link from "next/link";
import { MediaPicture } from "@/components/ui/media-picture";
import { ADMIN_ROUTES } from "@/config/admin";
import { fill } from "@/i18n/fill";
import { cx } from "@/lib/cx";
import { uiStyles } from "../ui/kit";
import type { AssetOption, SliderText } from "./types";
import styles from "./slider.module.css";

interface ImagePickerProps {
  readonly name: string;
  readonly legend: string;
  readonly hint: string;
  readonly assets: readonly AssetOption[];
  readonly value: string;
  readonly error: string | undefined;
  /** خيار «بلا صورة» للموضع الاختياري. */
  readonly noneLabel?: string;
  readonly text: SliderText;
}

/**
 * منتقي صورة من المكتبة: أزرار راديو حقيقية بمصغّراتها (لوحة المفاتيح والأسهم كما في أي مجموعة راديو)،
 * والمختار بإطار أصفر. بلا JavaScript نموذج عادي.
 */
export function ImagePicker(props: ImagePickerProps) {
  const { name, assets, value, error, text } = props;
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  return (
    <fieldset
      className={styles.picker}
      aria-describedby={error === undefined ? hintId : `${hintId} ${errorId}`}
    >
      <legend className={uiStyles.label}>{props.legend}</legend>
      <p id={hintId} className={uiStyles.hint}>
        {props.hint}
      </p>
      {assets.length === 0 ? (
        <p className={styles.pickerEmpty}>
          {text.form.noAssets}{" "}
          <Link href={ADMIN_ROUTES.contentMedia} prefetch={false}>
            {text.form.upload}
          </Link>
        </p>
      ) : null}
      <div className={styles.pickerGrid}>
        {props.noneLabel === undefined ? null : (
          <label className={cx(styles.choice, styles.choiceNone)}>
            <input type="radio" name={name} value="" defaultChecked={value === ""} />
            <span>{props.noneLabel}</span>
          </label>
        )}
        {assets.map((asset) => (
          <label key={asset.id} className={styles.choice}>
            <input type="radio" name={name} value={asset.id} defaultChecked={value === asset.id} />
            <MediaPicture
              image={asset}
              sizes="10rem"
              alt=""
              loading="lazy"
              className={styles.choiceImage}
            />
            <span className={styles.choiceMeta}>
              <bdi>{asset.name}</bdi>
              <span dir="ltr">
                {fill(text.form.dimensions, {
                  width: String(asset.width),
                  height: String(asset.height),
                })}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error === undefined ? null : (
        <p id={errorId} className={uiStyles.fieldError}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
