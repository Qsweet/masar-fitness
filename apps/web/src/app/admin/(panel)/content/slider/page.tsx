import type { DraftSlider } from "@masar/db";
import { hasPermission, MAX_SLIDES } from "@masar/domain";
import type { Metadata } from "next";
import { MediaBanner } from "@/components/admin/media/media-banner";
import { SlideList } from "@/components/admin/slider/slide-list";
import { SliderSettingsForm } from "@/components/admin/slider/settings-form";
import type { SliderText } from "@/components/admin/slider/types";
import {
  Alert,
  ButtonLink,
  Card,
  CardLink,
  EmptyState,
  Notice,
  noticeText,
  PageHeader,
} from "@/components/admin/ui/kit";
import { QueryError } from "@/components/admin/ui/query-error";
import { ADMIN_ROUTES, contentPreviewHref, PREVIEW_DRAFT } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { saveSliderSettingsAction } from "@/server/admin/actions/content-slider";
import { draftSummary } from "@/server/admin/content/overview";
import { clubTimezone } from "@/server/admin/content/timezone";
import { requireStaff } from "@/server/admin/guard";
import { loadSliderAdmin, targetOptions } from "@/server/admin/slider/slider-view";
import { mediaStatus } from "@/server/media/status";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().slider.list.title };
}

const MS_PER_SECOND = 1_000;

function DirtyNote({
  text,
  canPublish,
}: {
  readonly text: SliderText;
  readonly canPublish: boolean;
}) {
  return (
    <Alert tone="info">
      <span>
        {text.list.dirty}{" "}
        {canPublish ? (
          <CardLink href={ADMIN_ROUTES.contentPublish}>{text.list.publish}</CardLink>
        ) : (
          text.list.editorNote
        )}
      </span>
    </Alert>
  );
}

function SettingsCard({
  draft,
  dictionary,
  canWrite,
}: {
  readonly draft: DraftSlider;
  readonly dictionary: AdminDictionary;
  readonly canWrite: boolean;
}) {
  const text = dictionary.slider.settings;
  return (
    <Card title={text.title} description={text.lead} narrow>
      <SliderSettingsForm
        action={saveSliderSettingsAction}
        values={{
          autoplay: draft.settings.autoplay ? "on" : "",
          interval: String(draft.settings.intervalMs / MS_PER_SECOND),
        }}
        lockToken={draft.settingsToken}
        dictionary={dictionary}
        canWrite={canWrite}
      />
    </Card>
  );
}

/**
 * شريط الشرائح في المسودة (docs/ADMIN_A3_SLIDER.md §11): الشرائح بترتيبها وحالتها الآن، وأزرار
 * الترتيب، والإعدادات. لا يتغير الموقع حتى ينشر المالك أو المدير.
 */
export default async function SliderPage(props: PageProps<"/admin/content/slider">) {
  const { staff } = await requireStaff("content.read");
  const dictionary = getAdminDictionary();
  const text = dictionary.slider;
  const query = await props.searchParams;
  const [{ draft }, summary, timeZone, targets, media] = await Promise.all([
    loadSliderAdmin(staff.clubId),
    draftSummary(staff.clubId),
    clubTimezone(staff.clubId),
    targetOptions(text),
    mediaStatus(),
  ]);
  const canWrite = hasPermission(staff.role, "content.write");
  const canPublish = hasPermission(staff.role, "content.publish");
  const count = draft.slides.length;
  return (
    <>
      <PageHeader title={text.list.title} description={text.list.lead}>
        <ButtonLink href={contentPreviewHref(PREVIEW_DRAFT)}>{text.list.preview}</ButtonLink>
        {canWrite && count < MAX_SLIDES ? (
          <ButtonLink href={ADMIN_ROUTES.contentSliderNew} variant="primary">
            {text.list.new}
          </ButtonLink>
        ) : null}
      </PageHeader>
      <Notice text={noticeText(query.done, dictionary)} />
      <QueryError error={query.error} dictionary={dictionary} />
      <MediaBanner status={media} text={dictionary.media} backupText={dictionary.backup} />
      {summary.sliderChanges.length === 0 ? null : (
        <DirtyNote text={text} canPublish={canPublish} />
      )}
      <Card
        title={text.list.cardTitle}
        description={fill(text.list.cardLead, {
          count: formatNumber(count),
          max: formatNumber(MAX_SLIDES),
        })}
      >
        {count === 0 ? (
          <EmptyState
            icon="slider"
            title={text.list.emptyTitle}
            description={text.list.emptyLead}
          />
        ) : (
          <SlideList
            slides={draft.slides}
            targets={targets}
            timeZone={timeZone}
            now={new Date()}
            canWrite={canWrite}
            text={text}
          />
        )}
        {canWrite && count >= MAX_SLIDES ? <Alert tone="info">{text.list.full}</Alert> : null}
      </Card>
      <SettingsCard draft={draft} dictionary={dictionary} canWrite={canWrite} />
    </>
  );
}
