"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { CLASS_VIDEO } from "@/config/media";
import { cx } from "@/lib/cx";
import styles from "./loop-video.module.css";

interface LoopVideoProps {
  readonly posterAlt: string;
  readonly pauseLabel: string;
  readonly playLabel: string;
  /** أبعاد الإطار ومكانه من القسم الذي يضعه. */
  readonly className: string | undefined;
  readonly sizes: string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** يبدأ تحميل المقطع قبل أن يصل إطاره إلى الشاشة بقليل، لا عند فتح الصفحة. */
const NEAR_VIEWPORT = "300px 0px";

/** طلب توفير البيانات من المتصفح (Save-Data)، إن كان المتصفح يعلنه. */
function prefersSaveData(): boolean {
  const connection: unknown = Reflect.get(navigator, "connection");
  return (
    typeof connection === "object" &&
    connection !== null &&
    Reflect.get(connection, "saveData") === true
  );
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/** الفيديو مسموح: بلا تقليل حركة ولا توفير بيانات. على الخادم: الإطار وحده. */
function useMotionAllowed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !window.matchMedia(REDUCED_MOTION).matches && !prefersSaveData(),
    () => false,
  );
}

/** هل اقترب العنصر من الشاشة مرة واحدة على الأقل؟ بعدها يبقى صحيحًا. */
function useNearViewport(target: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (element === null) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_VIEWPORT },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [target]);
  return near;
}

type VideoLabels = Pick<LoopVideoProps, "pauseLabel" | "playLabel">;

/**
 * المقطع الصامت فوق الإطار: يظهر بعد أول إطار يعمل ويبقى ظاهرًا بعد الإيقاف (الإطار الأخير لا الصورة)،
 * ويختفي مع زره إن تعذّر تشغيله فيبقى الإطار. زر الإيقاف ظاهر ما دام المقطع موجودًا
 * (WCAG 2.2.2: حركة تلقائية تتجاوز 5 ثوانٍ).
 */
function AmbientVideo({ pauseLabel, playLabel }: VideoLabels) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return null;
  }

  function toggle(): void {
    const element = video.current;
    if (element === null) {
      return;
    }
    if (element.paused) {
      void element.play().catch(() => {
        setFailed(true);
      });
    } else {
      element.pause();
    }
  }

  return (
    <>
      <video
        ref={video}
        className={styles.video}
        data-started={started}
        src={CLASS_VIDEO.src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onPlaying={() => {
          setPlaying(true);
          setStarted(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
        onError={() => {
          setFailed(true);
        }}
      />
      <button type="button" className={styles.toggle} onClick={toggle}>
        <span aria-hidden="true" className={playing ? styles.iconPause : styles.iconPlay} />
        <span className="sr-only">{playing ? pauseLabel : playLabel}</span>
      </button>
    </>
  );
}

/**
 * مقطع صامت متكرر بإطاره: الإطار صورة تُحمَّل كسولة، والمقطع فوقه حين يُسمح ويقترب من الشاشة.
 * لا يُحمَّل المقطع مع تقليل الحركة ولا مع توفير البيانات، ولا على الخادم.
 */
export function LoopVideo({ posterAlt, pauseLabel, playLabel, className, sizes }: LoopVideoProps) {
  const frame = useRef<HTMLDivElement>(null);
  const allowed = useMotionAllowed();
  const near = useNearViewport(frame);
  return (
    <div ref={frame} className={cx(styles.frame, className)}>
      <Image
        src={CLASS_VIDEO.poster}
        alt={posterAlt}
        fill
        placeholder="blur"
        blurDataURL={CLASS_VIDEO.posterBlur}
        sizes={sizes}
      />
      {allowed && near ? <AmbientVideo pauseLabel={pauseLabel} playLabel={playLabel} /> : null}
    </div>
  );
}
