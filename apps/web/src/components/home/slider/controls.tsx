import { Icon } from "@/components/ui/icon";
import { fill } from "@/i18n/fill";
import styles from "./slider.module.css";

export interface CarouselLabels {
  readonly controls: string;
  readonly previous: string;
  readonly next: string;
  readonly pause: string;
  readonly play: string;
  readonly goTo: string;
}

interface ControlsProps {
  readonly state: {
    readonly count: number;
    readonly index: number;
    readonly canRotate: boolean;
    readonly playing: boolean;
    readonly stopped: boolean;
    readonly intervalMs: number;
  };
  readonly labels: CarouselLabels;
  readonly trackId: string;
  readonly goTo: (index: number) => void;
  readonly toggle: () => void;
}

/** النقطة الحالية تحمل شريط التقدّم؛ انتهاء حركته ينقل إلى التالية. */
function Dot({ dot, props }: { readonly dot: number; readonly props: ControlsProps }) {
  const { state, labels, trackId, goTo } = props;
  const current = dot === state.index;
  return (
    <button
      type="button"
      className={styles.dot}
      aria-controls={trackId}
      aria-current={current ? "true" : undefined}
      aria-label={fill(labels.goTo, { n: String(dot + 1) })}
      onClick={() => {
        goTo(dot);
      }}
    >
      {current && state.canRotate ? (
        <span
          key={`${String(state.index)}-${String(state.stopped)}`}
          className={styles.progress}
          data-running={state.playing ? "" : undefined}
          style={{ animationDuration: `${String(state.intervalMs)}ms` }}
          onAnimationEnd={() => {
            goTo(state.index + 1);
          }}
        />
      ) : null}
    </button>
  );
}

/** عناصر التحكم (APG): زر الإيقاف أولًا، ثم النقاط، ثم السابق والتالي، كلها تتحكم بالمسار. */
export function Controls(props: ControlsProps) {
  const { state, labels, trackId, goTo, toggle } = props;
  return (
    <div className={styles.controls} role="group" aria-label={labels.controls}>
      {state.canRotate ? (
        <button
          type="button"
          className={styles.control}
          aria-label={state.stopped ? labels.play : labels.pause}
          onClick={toggle}
        >
          <Icon name={state.stopped ? "play" : "pause"} />
        </button>
      ) : null}
      <div className={styles.dots}>
        {Array.from({ length: state.count }, (_, dot) => (
          <Dot key={dot} dot={dot} props={props} />
        ))}
      </div>
      <div className={styles.arrows}>
        {(["previous", "next"] as const).map((side) => (
          <button
            key={side}
            type="button"
            className={styles.control}
            aria-controls={trackId}
            aria-label={labels[side]}
            onClick={() => {
              goTo(state.index + (side === "next" ? 1 : -1));
            }}
          >
            <span className={side === "previous" ? styles.flip : undefined}>
              <Icon name="arrow" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
