"use client";

import { useRef } from "react";
import { buttonClass } from "@/components/ui/button-link";
import { Icon } from "@/components/ui/icon";
import type { ClubVideo } from "@/config/media";
import { VideoSources } from "./video-sources";
import styles from "./hero.module.css";

interface VideoDialogProps {
  readonly video: ClubVideo;
  readonly labels: {
    readonly watch: string;
    readonly videoTitle: string;
    readonly videoNote: string;
    readonly close: string;
  };
}

const TITLE_ID = "hero-video-title";

/**
 * «شاهد الفيديو»: المقطع نفسه في نافذة حوار أصلية (dialog) بعناصر تحكم المتصفح، بلا طرف ثالث.
 * الحوار يحبس التركيز ويُغلق بـEsc وبزر الإغلاق وبالنقر خارج المقطع، ويُوقف المقطع عند الإغلاق.
 * المصدر لا يُحمَّل قبل الفتح (preload="none").
 */
export function VideoDialog({ video, labels }: VideoDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const open = () => {
    dialog.current?.showModal();
    void player.current?.play();
  };
  const close = () => {
    dialog.current?.close();
  };
  return (
    <>
      <button type="button" className={buttonClass("outline")} onClick={open}>
        {labels.watch}
        <Icon name="play" />
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={TITLE_ID}
        onClose={() => player.current?.pause()}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            close();
          }
        }}
      >
        <div className={styles.dialogHead}>
          <h2 id={TITLE_ID} className={styles.dialogTitle}>
            {labels.videoTitle}
          </h2>
          <button type="button" className={styles.dialogClose} onClick={close}>
            <Icon name="close" />
            <span className="sr-only">{labels.close}</span>
          </button>
        </div>
        <video
          ref={player}
          className={styles.dialogVideo}
          controls
          muted
          playsInline
          preload="none"
          poster={video.poster.src}
          aria-describedby={`${TITLE_ID}-note`}
        >
          <VideoSources video={video} />
        </video>
        <p id={`${TITLE_ID}-note`} className={styles.dialogNote}>
          {labels.videoNote}
        </p>
      </dialog>
    </>
  );
}
