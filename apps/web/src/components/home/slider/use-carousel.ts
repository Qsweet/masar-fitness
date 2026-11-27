import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/**
 * سلوك الشريط في المتصفح (docs/ADMIN_A3_SLIDER.md §10) بلا مكتبة: الشريحة الحالية من موضع التمرير،
 * والانتقال بالتمرير نفسه (scroll-snap يبقى المرجع)، وتفضيل تقليل الحركة، وظهور اللسان، والسحب بالفأرة.
 */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** نصف الشريحة ظاهر على الأقل لتُعدّ الحالية. */
const VISIBLE_RATIO = 0.6;
/** حركة الفأرة التي تجعل الضغط سحبًا لا نقرًا (بكسل). */
const DRAG_THRESHOLD = 6;

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/** تقليل الحركة: true على الخادم وقبل التحميل، فلا تشغيل تلقائي قبل أن يُعرف التفضيل. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** هل اللسان ظاهر؟ اللسان المخفي يوقف التشغيل التلقائي. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
}

/** مرور الفأرة أو التركيز داخل الشريط يوقف التشغيل التلقائي (WCAG 2.2.2). */
export function useHold() {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return {
    held: hover || focus,
    handlers: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        setHover(event.pointerType === "mouse");
      },
      onPointerLeave: () => {
        setHover(false);
      },
      onFocus: () => {
        setFocus(true);
      },
      onBlur: (event: FocusEvent<HTMLElement>) => {
        setFocus(event.currentTarget.contains(event.relatedTarget));
      },
    },
  };
}

/** الشريحة الأكثر ظهورًا في المسار (يعمل مع اللمس والعجلة ولوحة المفاتيح والأسهم). */
export function useCurrentSlide(
  track: RefObject<HTMLElement | null>,
  onChange: (index: number) => void,
): void {
  useEffect(() => {
    const element = track.current;
    if (element === null) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const shown = entries.find((entry) => entry.intersectionRatio >= VISIBLE_RATIO);
        const index = Number(shown?.target.getAttribute("data-slide"));
        if (shown !== undefined && Number.isInteger(index)) {
          onChange(index);
        }
      },
      { root: element, threshold: VISIBLE_RATIO },
    );
    for (const child of element.children) {
      observer.observe(child);
    }
    return () => {
      observer.disconnect();
    };
  }, [track, onChange]);
}

/**
 * الشرائح غير الحالية خاملة (`inert`) مع JavaScript: لا تركيز ولا قارئ شاشة يدخلها وهي خارج الشاشة،
 * والتنقل بالأسهم والنقاط. بلا JavaScript كلها حية (المسار يُمرَّر).
 */
export function useInertOthers(
  track: RefObject<HTMLElement | null>,
  index: number,
  enabled: boolean,
): void {
  useEffect(() => {
    const slides = track.current === null ? [] : [...track.current.children];
    for (const [position, slide] of slides.entries()) {
      slide.toggleAttribute("inert", enabled && position !== index);
    }
  }, [track, index, enabled]);
}

/** يمرّر المسار إلى شريحة (المسار باتجاه الصفحة: في RTL يكون الموضع سالبًا). */
export function scrollToSlide(track: HTMLElement, index: number, smooth: boolean): void {
  const sign = getComputedStyle(track).direction === "rtl" ? -1 : 1;
  track.scrollTo({ left: sign * index * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
}

interface Drag {
  readonly x: number;
  readonly left: number;
  moved: boolean;
}

/**
 * السحب بالفأرة على الحاسوب (اللمس يمرّر أصلًا): المسار يتبع المؤشر، وعند الإفلات ينتقل إلى أقرب شريحة.
 * سحب حقيقي يلغي النقر الذي يليه، فلا يُفتح رابط الشريحة بالخطأ.
 */
export function useMouseDrag(
  track: RefObject<HTMLElement | null>,
  settle: (index: number) => void,
) {
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType !== "mouse" || event.button !== 0 || track.current === null) {
        return;
      }
      drag.current = { x: event.clientX, left: track.current.scrollLeft, moved: false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = drag.current;
      const element = track.current;
      if (current === null || element === null) {
        return;
      }
      const dx = event.clientX - current.x;
      if (!current.moved && Math.abs(dx) > DRAG_THRESHOLD) {
        current.moved = true;
        element.setPointerCapture(event.pointerId);
        setDragging(true);
      }
      if (current.moved) {
        element.scrollTo({ left: current.left - dx, behavior: "instant" });
      }
    },
    onPointerUp() {
      const element = track.current;
      const moved = drag.current?.moved ?? false;
      drag.current = null;
      if (element === null || !moved) {
        return;
      }
      setDragging(false);
      suppressClick.current = true;
      settle(Math.round(Math.abs(element.scrollLeft) / element.clientWidth));
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
