"use client";

import type { TrackEvent as TrackEventName } from "@masar/domain";
import { useEffect, useRef } from "react";
import { newEventId, track } from "./track";
import type { TrackPayload } from "./types";

interface TrackEventProps {
  readonly event: TrackEventName;
  readonly payload: Omit<TrackPayload, "eventId"> & { readonly eventId?: string };
  /** مفتاح «مرة لكل متصفح» (الشراء): إعادة تحميل الصفحة لا تكرر الحدث. */
  readonly onceKey?: string;
}

function seenBefore(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key) !== null) {
      return true;
    }
    window.sessionStorage.setItem(key, "1");
    return false;
  } catch {
    return false;
  }
}

/** حدث الصفحة عند عرضها: القيم يكتبها الخادم، والمكوّن يسجّلها في الناقل فقط. */
export function TrackEvent({ event, payload, onceKey }: TrackEventProps) {
  // الحمولة ثابتة من الخادم لعرض الصفحة: الحدث مرة لكل عرض لا مع كل كائن جديد
  const data = useRef(payload);
  useEffect(() => {
    if (onceKey !== undefined && seenBefore(`masar_tracked:${onceKey}`)) {
      return;
    }
    track(event, { ...data.current, eventId: data.current.eventId ?? newEventId() });
  }, [event, onceKey]);
  return null;
}
