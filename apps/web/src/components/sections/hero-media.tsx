"use client";

import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";
import { HERO_VIDEO } from "@/config/media";
import styles from "./hero.module.css";

interface HeroMediaProps {
  readonly posterAlt: string;
  readonly pauseLabel: string;
  readonly playLabel: string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

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

type VideoLabels = Pick<HeroMediaProps, "pauseLabel" | "playLabel">;

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
        src={HERO_VIDEO.src}
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
      <button type="button" className={styles.videoToggle} onClick={toggle}>
        <span aria-hidden="true" className={playing ? styles.iconPause : styles.iconPlay} />
        <span className="sr-only">{playing ? pauseLabel : playLabel}</span>
      </button>
    </>
  );
}

/**
 * وسائط الواجهة: إطار الفيديو صورةً (عنصر LCP، يُحمَّل مسبقًا) ثم المقطع الصامت فوقه حين يُسمح:
 * لا يُحمَّل المقطع مع تقليل الحركة ولا مع توفير البيانات، ولا على الخادم.
 */
export function HeroMedia({ posterAlt, pauseLabel, playLabel }: HeroMediaProps) {
  const allowed = useMotionAllowed();
  return (
    <div className={styles.media}>
      <Image
        src={HERO_VIDEO.poster}
        alt={posterAlt}
        fill
        preload
        placeholder="blur"
        blurDataURL={HERO_VIDEO.posterBlur}
        sizes="(min-width: 64rem) 60vw, 100vw"
      />
      {allowed ? <AmbientVideo pauseLabel={pauseLabel} playLabel={playLabel} /> : null}
    </div>
  );
}
