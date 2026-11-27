import { MediaPicture } from "@/components/ui/media-picture";
import { textFieldName } from "@/server/admin/slider/slide-form-names";
import type { FormValues } from "@/server/admin/field-form";
import type { AssetOption, SliderText } from "./types";
import styles from "./editor.module.css";

/**
 * معاينة حية للشريحة بجانب الحقول (docs/ADMIN_A3_SLIDER.md §11): الصورة والنصوص العربية بالتدرّج
 * والزر كما في الموقع تقريبًا، من قيم النموذج نفسها بلا شبكة. بلا JavaScript تُرسم بالقيم المحفوظة.
 */
export function SlidePreview({
  values,
  assets,
  text,
}: {
  readonly values: FormValues;
  readonly assets: readonly AssetOption[];
  readonly text: SliderText;
}) {
  const image = assets.find((asset) => asset.id === values.desktop);
  const read = (field: "eyebrow" | "title" | "subtitle" | "cta") =>
    values[textFieldName("ar", field)]?.trim() ?? "";
  const cta = values.linkKind === "none" ? "" : read("cta");
  return (
    <div className={styles.preview} data-testid="slide-preview">
      <p className={styles.previewTitle}>{text.form.previewTitle}</p>
      <div className={styles.previewFrame} dir="rtl" lang="ar">
        {image === undefined ? (
          <p className={styles.previewEmpty}>{text.form.previewEmpty}</p>
        ) : (
          <>
            <MediaPicture
              image={image}
              sizes="(min-width: 64rem) 30rem, 100vw"
              alt=""
              loading="eager"
              className={styles.previewImage}
            />
            <div className={styles.previewScrim} />
            <div className={styles.previewText}>
              {read("eyebrow") === "" ? null : (
                <span className={styles.previewEyebrow}>{read("eyebrow")}</span>
              )}
              {read("title") === "" ? null : (
                <span className={styles.previewHeading}>{read("title")}</span>
              )}
              {read("subtitle") === "" ? null : <span>{read("subtitle")}</span>}
              {cta === "" ? null : <span className={styles.previewCta}>{cta}</span>}
            </div>
          </>
        )}
      </div>
      <p className={styles.note}>{text.form.previewLead}</p>
    </div>
  );
}
