"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useEnhanced } from "@/components/ui/use-enhanced";
import {
  scrollToSlide,
  useCurrentSlide,
  useHold,
  useMouseDrag,
  usePageVisible,
  useReducedMotion,
} from "./use-carousel";
import { Controls, type CarouselLabels } from "./controls";
import styles from "./slider.module.css";

interface CarouselProps {
  readonly count: number;
  readonly autoplay: boolean;
  readonly intervalMs: number;
  readonly labels: CarouselLabels;
  /** الشرائح مرسومة على الخادم (عنصر لكلٍّ بدور «مجموعة»؛ لا قائمة: عنصر القائمة لا يأخذ دورًا آخر). */
  readonly children: ReactNode;
}

export const TRACK_ID = "home-slider-track";

/** الشريحة التي يطلبها مفتاح: الأسهم بحسب الاتجاه (في RTL الأيسر «التالي»)، وHome وEnd؛ أو null. */
export function keyTarget(key: string, rtl: boolean, index: number, count: number): number | null {
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const backward = rtl ? "ArrowRight" : "ArrowLeft";
  const targets: Readonly<Record<string, number>> = {
    [forward]: index + 1,
    [backward]: index - 1,
    Home: 0,
    End: count - 1,
  };
  return Object.hasOwn(targets, key) ? (targets[key] ?? null) : null;
}

/**
 * الشريط في المتصفح (docs/ADMIN_A3_SLIDER.md §10، نمط APG «Carousel»): بلا JavaScript مسار أفقي يُمرَّر
 * بالتقاط الشرائح؛ ومعه أسهم ونقاط بتقدّم، وزر إيقاف/تشغيل أولًا، ولوحة المفاتيح، والسحب بالفأرة.
 * التشغيل التلقائي هو حركة شريط التقدّم نفسها (انتهاؤها ينقل)، فيتوقف معها عند المرور والتركيز وإخفاء
 * اللسان وإيقاف الزائر، ولا يعمل مع تقليل الحركة.
 */
/** هل يدور الشريط الآن؟ ممكن مع JavaScript والإعداد وبلا تقليل حركة؛ ويجري ما لم يوقفه شيء. */
function usePlayback(enhanced: boolean, autoplay: boolean, count: number) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [stopped, setStopped] = useState(false);
  const hold = useHold();
  const canRotate = [enhanced, autoplay, !reduced, count > 1].every(Boolean);
  const playing = [canRotate, !stopped, !hold.held, visible].every(Boolean);
  return { reduced, stopped, setStopped, hold, canRotate, playing };
}

export function Carousel({ count, autoplay, intervalMs, labels, children }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const enhanced = useEnhanced();
  const [index, setIndex] = useState(0);
  const { reduced, stopped, setStopped, hold, canRotate, playing } = usePlayback(
    enhanced,
    autoplay,
    count,
  );
  const goTo = (target: number) => {
    if (track.current !== null) {
      scrollToSlide(track.current, (target + count) % count, !reduced);
    }
  };
  useCurrentSlide(track, setIndex);
  const { dragging, ...drag } = useMouseDrag(track, goTo);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const target = keyTarget(event.key, rtl, index, count);
    if (target !== null) {
      event.preventDefault();
      goTo(target);
    }
  };
  return (
    <div
      className={styles.frame}
      data-enhanced={enhanced ? "" : undefined}
      onKeyDown={onKeyDown}
      {...hold.handlers}
    >
      <div
        id={TRACK_ID}
        ref={track}
        className={styles.track}
        aria-live={playing ? "off" : "polite"}
        data-dragging={dragging ? "" : undefined}
        {...drag}
      >
        {children}
      </div>
      {enhanced && count > 1 ? (
        <Controls
          state={{ count, index, canRotate, playing, stopped, intervalMs }}
          labels={labels}
          trackId={TRACK_ID}
          goTo={goTo}
          toggle={() => {
            setStopped(!stopped);
          }}
        />
      ) : null}
    </div>
  );
}
