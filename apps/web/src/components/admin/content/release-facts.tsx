import type { AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { Facts } from "../ui/kit";

export interface ReleaseFactsView {
  readonly seq: number;
  readonly source: "publish" | "rollback";
  readonly rolledBackFromSeq: number | null;
  readonly publisherName: string;
  readonly publishedAt: Date;
  readonly changedCount: number;
}

/** وصف إصدار في سطور «التسمية: القيمة»: رقمه ومصدره وناشره ووقته وعدد تغييراته. */
export function ReleaseFacts({
  release,
  timezone,
  text,
}: {
  readonly release: ReleaseFactsView;
  readonly timezone: string;
  readonly text: AdminDictionary["content"];
}) {
  const { overview, history } = text;
  const source =
    release.rolledBackFromSeq === null
      ? history.sources[release.source]
      : fill(history.rollbackOf, { seq: formatNumber(release.rolledBackFromSeq) });
  return (
    <Facts
      items={[
        [overview.seq, fill(overview.seqValue, { seq: formatNumber(release.seq) })],
        [overview.source, source],
        [overview.publishedBy, release.publisherName],
        [overview.publishedAt, formatDateTime(release.publishedAt, timezone)],
        [overview.changes, formatNumber(release.changedCount)],
      ]}
    />
  );
}
