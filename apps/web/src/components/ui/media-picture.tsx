import type { SlideImage } from "@masar/domain";
import { mediaFileUrl, type MediaFormat } from "@/config/media-library";

/**
 * صورة من المكتبة بنسخها المولَّدة مسبقًا (docs/ADMIN_A3_SLIDER.md §6، §10): AVIF ثم WebP بكل العروض،
 * واتجاه فني اختياري بصورة للهاتف تحت استعلام وسائط. لا `next/image`: النسخ جاهزة، والمحمِّل الخاص يحتاج
 * مكوّن عميل. الأبعاد في الوسم ولون الأصل وضبابه خلفية، فلا قفزة في التخطيط قبل التحميل.
 */
interface MediaPictureProps {
  readonly image: SlideImage;
  /** صورة الهاتف (اتجاه فني) تحت `mobileQuery`. */
  readonly mobile?: SlideImage | null;
  readonly mobileQuery?: string;
  readonly sizes: string;
  readonly alt: string;
  readonly loading: "eager" | "lazy";
  readonly className?: string | undefined;
}

function srcSet(image: SlideImage, format: MediaFormat): string {
  return image.widths
    .map((width) => `${mediaFileUrl(image.hash, width, format)} ${String(width)}w`)
    .join(", ");
}

function Sources({
  image,
  sizes,
  media,
}: {
  readonly image: SlideImage;
  readonly sizes: string;
  readonly media?: string | undefined;
}) {
  return (
    <>
      <source media={media} type="image/avif" srcSet={srcSet(image, "avif")} sizes={sizes} />
      <source media={media} type="image/webp" srcSet={srcSet(image, "webp")} sizes={sizes} />
    </>
  );
}

export function MediaPicture({
  image,
  mobile,
  mobileQuery,
  sizes,
  alt,
  loading,
  className,
}: MediaPictureProps) {
  const fallback = image.widths.at(-1) ?? image.width;
  return (
    <picture>
      {mobile === undefined || mobile === null ? null : (
        <Sources image={mobile} sizes={sizes} media={mobileQuery} />
      )}
      <Sources image={image} sizes={sizes} />
      <img
        className={className}
        src={mediaFileUrl(image.hash, fallback, "webp")}
        width={image.width}
        height={image.height}
        alt={alt}
        loading={loading}
        decoding="async"
        style={{ backgroundColor: image.color, backgroundImage: `url("${image.blur}")` }}
      />
    </picture>
  );
}
