"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { ClubVideo } from "@/config/media";
import { cx } from "@/lib/cx";
import { useMotionAllowed } from "./motion-allowed";
import { VideoSources } from "./video-sources";
import styles from "./hero.module.css";

interface BackgroundVideoProps {
  readonly video: ClubVideo;
  readonly labels: { readonly pause: string; readonly play: string };
}

/**
 * فيديو الخلفية فوق الصورة الثابتة: يُركَّب بعد التحميل فقط ولا يُركَّب مع تقليل الحركة أو توفير البيانات،
 * فلا يؤخر عنصر LCP (الصورة). يظهر بتلاشٍ حين يبدأ التشغيل فعلًا. زر الإيقاف ظاهر دائمًا (WCAG 2.2.2).
 * المقطع صامت فلا يحتاج ترجمة نصية، وهو زخرفي للقارئ (aria-hidden) فمعناه في العنوان.
 */
export function BackgroundVideo({ video, labels }: BackgroundVideoProps) {
  const allowed = useMotionAllowed();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  if (!allowed) {
    return null;
  }
  const toggle = () => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    if (element.paused) {
      void element.play();
    } else {
      element.pause();
    }
  };
  return (
    <>
      <video
        ref={ref}
        className={cx(styles.video, playing && styles.videoOn)}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
      >
        <VideoSources video={video} />
      </video>
      <button type="button" className={styles.toggle} onClick={toggle}>
        <Icon name={playing ? "pause" : "play"} />
        <span className="sr-only">{playing ? labels.pause : labels.play}</span>
      </button>
    </>
  );
}
