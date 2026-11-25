import type { ClubVideo } from "@/config/media";

/** مصادر المقطع بالعرض: الأول المطابق يُحمَّل وحده. */
export function VideoSources({ video }: { readonly video: ClubVideo }) {
  return video.sources.map((source) => (
    <source key={source.src} src={source.src} media={source.media} type={video.type} />
  ));
}
