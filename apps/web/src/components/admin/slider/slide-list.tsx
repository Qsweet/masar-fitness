import { slideStatus, type SlideStatus } from "@masar/domain";
import type { DraftSlide } from "@masar/db";
import Link from "next/link";
import { MediaPicture } from "@/components/ui/media-picture";
import { slidePath } from "@/config/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { moveSlideAction } from "@/server/admin/actions/content-slider";
import { linkLabel } from "@/server/admin/slider/slider-view";
import { AdminIcon } from "../admin-icon";
import { Badge, buttonClass, type Tone } from "../ui/kit";
import { SubmitButton } from "../ui/submit-button";
import { slideName } from "./slider-diff";
import type { SliderText, TargetOption } from "./types";
import styles from "./slider.module.css";

const STATUS_TONES: Readonly<Record<SlideStatus, Tone>> = {
  live: "success",
  scheduled: "info",
  expired: "warning",
  hidden: "neutral",
};

interface ListProps {
  readonly slides: readonly DraftSlide[];
  readonly targets: readonly TargetOption[];
  readonly timeZone: string;
  readonly now: Date;
  readonly canWrite: boolean;
  readonly text: SliderText;
}

function schedule(slide: DraftSlide, timeZone: string, text: SliderText): string {
  const parts = [
    slide.startsAt === null
      ? null
      : fill(text.list.from, { from: formatDateTime(slide.startsAt, timeZone) }),
    slide.endsAt === null
      ? null
      : fill(text.list.until, { to: formatDateTime(slide.endsAt, timeZone) }),
  ].filter((part) => part !== null);
  return parts.length === 0 ? text.list.always : parts.join(" · ");
}

function MoveButtons({
  slide,
  index,
  count,
  text,
}: {
  slide: DraftSlide;
  index: number;
  count: number;
  text: SliderText;
}) {
  const name = slideName(slide, text);
  const button = (direction: "up" | "down", disabled: boolean) => (
    <form action={moveSlideAction}>
      <input type="hidden" name="id" value={slide.id} />
      <input type="hidden" name="direction" value={direction} />
      {disabled ? (
        <button type="button" disabled className={buttonClass({ variant: "ghost", size: "small" })}>
          {direction === "up" ? text.list.moveUp : text.list.moveDown}
        </button>
      ) : (
        <SubmitButton
          variant="ghost"
          size="small"
          label={fill(direction === "up" ? text.list.moveUpLabel : text.list.moveDownLabel, {
            name,
          })}
        >
          {direction === "up" ? text.list.moveUp : text.list.moveDown}
        </SubmitButton>
      )}
    </form>
  );
  return (
    <div className={styles.moves}>
      {button("up", index === 0)}
      {button("down", index === count - 1)}
    </div>
  );
}

/** الشرائح بترتيب العرض: مصغّر، واسم، وحالة الآن، وجدولة، ورابط، وأزرار الترتيب والتعديل. */
export function SlideList({ slides, targets, timeZone, now, canWrite, text }: ListProps) {
  return (
    <ol className={styles.list} data-testid="slide-list">
      {slides.map((slide, index) => {
        const status = slideStatus(slide, now);
        const name = slideName(slide, text);
        return (
          <li key={slide.id} className={styles.row}>
            <span className={styles.rowIndex}>{formatNumber(index + 1)}</span>
            <MediaPicture
              image={slide.desktop}
              sizes="10rem"
              alt=""
              loading="lazy"
              className={styles.rowThumb}
            />
            <div className={styles.rowBody}>
              <div className={styles.rowHead}>
                <Link href={slidePath(slide.id)} prefetch={false} className={styles.rowName}>
                  <bdi>{name}</bdi>
                </Link>
                <Badge tone={STATUS_TONES[status]}>{text.statuses[status]}</Badge>
              </div>
              <p className={styles.rowMeta}>
                <AdminIcon name="external" /> <bdi>{linkLabel(slide.link, targets, text)}</bdi>
              </p>
              <p className={styles.rowMeta}>{schedule(slide, timeZone, text)}</p>
            </div>
            <div className={styles.rowActions}>
              {canWrite ? (
                <MoveButtons slide={slide} index={index} count={slides.length} text={text} />
              ) : null}
              <Link
                href={slidePath(slide.id)}
                prefetch={false}
                className={buttonClass({ size: "small" })}
                aria-label={fill(text.list.editLabel, { name })}
              >
                {text.list.edit}
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
