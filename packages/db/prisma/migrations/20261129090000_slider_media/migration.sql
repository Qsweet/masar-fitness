-- شريط الشرائح تحت الواجهة ومكتبة الوسائط (docs/ADMIN_A3_SLIDER.md §12). الجزء الأول مولَّد من
-- schema.prisma، والجزء اليدوي بعده: قيود CHECK والمحفّزان C2 وC3 وكيان التدقيق الجديد.
-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "variant_widths" INTEGER[],
    "blur_data_url" TEXT NOT NULL,
    "dominant_color" CHAR(7) NOT NULL,
    "original_name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_slides" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "desktop_asset_id" UUID NOT NULL,
    "mobile_asset_id" UUID,
    "decorative" BOOLEAN NOT NULL,
    "alt_ar" TEXT NOT NULL,
    "alt_en" TEXT NOT NULL,
    "eyebrow_ar" TEXT NOT NULL,
    "eyebrow_en" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "subtitle_ar" TEXT NOT NULL,
    "subtitle_en" TEXT NOT NULL,
    "cta_ar" TEXT NOT NULL,
    "cta_en" TEXT NOT NULL,
    "link_kind" TEXT NOT NULL,
    "link_target" TEXT NOT NULL,
    "link_new_tab" BOOLEAN NOT NULL,
    "click_target" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_slider_settings" (
    "club_id" UUID NOT NULL,
    "autoplay" BOOLEAN NOT NULL,
    "interval_ms" INTEGER NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_slider_settings_pkey" PRIMARY KEY ("club_id")
);

-- CreateTable
CREATE TABLE "content_release_media" (
    "release_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,

    CONSTRAINT "content_release_media_pkey" PRIMARY KEY ("release_id","asset_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_club_id_sha256_key" ON "media_assets"("club_id", "sha256");

-- CreateIndex
CREATE INDEX "content_slides_club_id_position_idx" ON "content_slides"("club_id", "position");

-- CreateIndex
CREATE INDEX "content_release_media_asset_id_idx" ON "content_release_media"("asset_id");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slides" ADD CONSTRAINT "content_slides_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slides" ADD CONSTRAINT "content_slides_desktop_asset_id_fkey" FOREIGN KEY ("desktop_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slides" ADD CONSTRAINT "content_slides_mobile_asset_id_fkey" FOREIGN KEY ("mobile_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slides" ADD CONSTRAINT "content_slides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slides" ADD CONSTRAINT "content_slides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slider_settings" ADD CONSTRAINT "content_slider_settings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_slider_settings" ADD CONSTRAINT "content_slider_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_release_media" ADD CONSTRAINT "content_release_media_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "content_releases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_release_media" ADD CONSTRAINT "content_release_media_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;



-- ═════════════ الجزء اليدوي ═════════════

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_sha256_shape" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  -- الأبعاد بعد التدوير، وحدود الرفع (ADMIN_A3_SLIDER §6.1): الضلع حتى 8000 والملف حتى 8 MiB
  ADD CONSTRAINT "media_assets_dimensions_valid"
    CHECK ("width" BETWEEN 1 AND 8000 AND "height" BETWEEN 1 AND 8000),
  ADD CONSTRAINT "media_assets_bytes_valid" CHECK ("bytes" BETWEEN 1 AND 8388608),
  ADD CONSTRAINT "media_assets_variants_valid"
    CHECK ("variant_widths" IS NOT NULL AND cardinality("variant_widths") BETWEEN 1 AND 8
      AND array_position("variant_widths", NULL) IS NULL),
  ADD CONSTRAINT "media_assets_blur_shape"
    CHECK ("blur_data_url" LIKE 'data:image/webp;base64,%' AND char_length("blur_data_url") <= 2048),
  ADD CONSTRAINT "media_assets_color_shape" CHECK ("dominant_color" ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT "media_assets_name_length" CHECK (char_length("original_name") BETWEEN 1 AND 120);

-- C2: الأصل لا يتغير بعد إنشائه (ملفاته تحت بصمته لا تُعاد كتابتها، ووصفه منسوخ في لقطات الإصدارات).
-- الحذف مسموح للقاعدة نفسها، وتمنعه FK RESTRICT ما دامت شريحة أو إصدار يستعمله.
CREATE TRIGGER "media_assets_forbid_update" BEFORE UPDATE ON "media_assets"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('media_asset_immutable');

ALTER TABLE "content_slides"
  ADD CONSTRAINT "content_slides_position_valid" CHECK ("position" BETWEEN 0 AND 7),
  ADD CONSTRAINT "content_slides_link_kind_known" CHECK ("link_kind" IN ('none', 'internal', 'external')),
  ADD CONSTRAINT "content_slides_click_target_known" CHECK ("click_target" IN ('slide', 'button')),
  -- شكل الرابط بنوعه: لا شيء فارغ، والداخلي مسار من الأصل نفسه، والخارجي https فقط حتى 500 محرف
  ADD CONSTRAINT "content_slides_link_shape" CHECK (
    ("link_kind" = 'none' AND "link_target" = '' AND NOT "link_new_tab" AND "click_target" = 'button')
    OR ("link_kind" = 'internal' AND "link_target" ~ '^/' AND "link_target" !~ '^//'
      AND char_length("link_target") <= 200 AND NOT "link_new_tab")
    OR ("link_kind" = 'external' AND "link_target" ~ '^https://[a-z0-9]'
      AND char_length("link_target") <= 500)),
  -- بلا رابط لا زر
  ADD CONSTRAINT "content_slides_cta_needs_link"
    CHECK ("link_kind" <> 'none' OR ("cta_ar" = '' AND "cta_en" = '')),
  -- النص البديل باللغتين، أو صورة زخرفية بلا نص بديل
  ADD CONSTRAINT "content_slides_alt_valid" CHECK (
    ("decorative" AND "alt_ar" = '' AND "alt_en" = '')
    OR (NOT "decorative" AND char_length("alt_ar") BETWEEN 1 AND 250
      AND char_length("alt_en") BETWEEN 1 AND 250)),
  ADD CONSTRAINT "content_slides_text_lengths" CHECK (
    char_length("eyebrow_ar") <= 40 AND char_length("eyebrow_en") <= 40
    AND char_length("title_ar") <= 70 AND char_length("title_en") <= 70
    AND char_length("subtitle_ar") <= 160 AND char_length("subtitle_en") <= 160
    AND char_length("cta_ar") <= 30 AND char_length("cta_en") <= 30),
  ADD CONSTRAINT "content_slides_schedule_order"
    CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");

ALTER TABLE "content_slider_settings"
  ADD CONSTRAINT "content_slider_settings_interval_valid" CHECK ("interval_ms" BETWEEN 4000 AND 15000);

-- C3: أصل دخل إصدارًا لا يخرج منه أبدًا (مع FK RESTRICT): الاسترجاع إلى أي إصدار يجد صوره
CREATE TRIGGER "content_release_media_forbid_mutation" BEFORE UPDATE OR DELETE ON "content_release_media"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('content_release_media_immutable');
CREATE TRIGGER "content_release_media_forbid_truncate" BEFORE TRUNCATE ON "content_release_media"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_mutation"('content_release_media_immutable');

-- التدقيق يقبل الشرائح (إسقاط وإعادة إنشاء كالسابقات)
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_entity_type_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_type_known"
  CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request', 'payment_attempt',
    'staff_user', 'product', 'promotion', 'customer', 'club', 'manual_payment',
    'content_release', 'content_draft', 'media_asset', 'content_slide'));
