import type { TrackEvent } from "@masar/domain";
import type { Sink, TrackCall, TrackPayload } from "./types";

/**
 * ناقل الأحداث في المتصفح (ADMIN_A5_TRACKING §2): الصفحة تسجّل الحدث مرة، والوجهات المحمَّلة بعد
 * الموافقة تترجمه. ما يقع قبل الموافقة يُرسل إن وافق الزائر وهو على الصفحة نفسها، ولا يُرسل ما وقع
 * في صفحة سابقة. بلا منصة مفعّلة أو بلا موافقة لا وجهة، فلا شيء يخرج.
 */
const sinks = new Set<Sink>();
let pending: { readonly call: TrackCall; readonly path: string }[] = [];
const MAX_PENDING = 20;

export function track(event: TrackEvent, payload: TrackPayload): void {
  const call = { event, payload };
  pending = [...pending, { call, path: window.location.pathname }].slice(-MAX_PENDING);
  for (const sink of sinks) {
    sink.send(call);
  }
}

/** وجهة حُمّلت بعد الموافقة تأخذ ما وقع في الصفحة الحالية وحدها قبل تحميلها. */
export function addSink(sink: Sink): void {
  sinks.add(sink);
  const path = window.location.pathname;
  for (const entry of pending.filter((item) => item.path === path)) {
    sink.send(entry.call);
  }
}

export function hasSinks(): boolean {
  return sinks.size > 0;
}

export function newEventId(): string {
  return crypto.randomUUID();
}
