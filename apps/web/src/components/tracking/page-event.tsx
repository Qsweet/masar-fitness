import type { TrackEvent as TrackEventName } from "@masar/domain";
import { TrackEvent } from "./track-event";
import type { TrackPayload } from "./types";
import { pageTracking } from "@/server/tracking/page-tracking";

interface PageEventProps {
  readonly event: TrackEventName;
  readonly payload: Omit<TrackPayload, "eventId"> & { readonly eventId?: string };
  readonly onceKey?: string;
}

/**
 * حدث صفحة يكتبه الخادم (ADMIN_A5_TRACKING §2). بلا منصة مفعّلة لا يُرسم مكوّن العميل أصلًا، فلا
 * JavaScript إضافي في الصفحة.
 */
export async function PageEvent({ event, payload, onceKey }: PageEventProps) {
  if ((await pageTracking()) === null) {
    return null;
  }
  return (
    <TrackEvent event={event} payload={payload} {...(onceKey === undefined ? {} : { onceKey })} />
  );
}
