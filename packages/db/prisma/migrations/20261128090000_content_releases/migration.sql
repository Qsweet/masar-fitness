-- المرحلة A3 (WP2): إصدارات المحتوى المنشورة (docs/ADMIN_A3_CONTENT.md §10). الجزء الأول مولَّد من
-- schema.prisma، والجزء اليدوي بعده: قيود CHECK والمحفّز C1 وكيانات التدقيق.

-- CreateTable
CREATE TABLE "content_releases" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "schema_version" SMALLINT NOT NULL,
    "digest" CHAR(64) NOT NULL,
    "source" TEXT NOT NULL,
    "changed_count" INTEGER NOT NULL,
    "rolled_back_from" UUID,
    "published_by" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_releases_club_id_seq_key" ON "content_releases"("club_id", "seq");

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_rolled_back_from_fkey" FOREIGN KEY ("rolled_back_from") REFERENCES "content_releases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ═════════════ الجزء اليدوي ═════════════

ALTER TABLE "content_releases"
  ADD CONSTRAINT "content_releases_seq_positive" CHECK ("seq" > 0),
  ADD CONSTRAINT "content_releases_schema_known" CHECK ("schema_version" = 1),
  ADD CONSTRAINT "content_releases_digest_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "content_releases_source_known" CHECK ("source" IN ('publish', 'rollback')),
  ADD CONSTRAINT "content_releases_snapshot_object" CHECK (jsonb_typeof("snapshot") = 'object'),
  ADD CONSTRAINT "content_releases_changed_count_valid" CHECK ("changed_count" >= 0),
  -- الاسترجاع وحده يشير إلى إصدار سابق، والنشر لا يشير
  ADD CONSTRAINT "content_releases_rollback_source"
    CHECK (("source" = 'rollback') = ("rolled_back_from" IS NOT NULL));

-- C1: الإصدار للإلحاق فقط، فالسجل لا يُعاد كتابته وذاكرة اللقطة في الخادم لا تُبطَل أبدًا
CREATE TRIGGER "content_releases_forbid_mutation" BEFORE UPDATE OR DELETE ON "content_releases"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('content_release_immutable');

-- التدقيق يقبل كيانات المحتوى (إسقاط وإعادة إنشاء كالسابقات)
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_entity_type_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_type_known"
  CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request', 'payment_attempt',
    'staff_user', 'product', 'promotion', 'customer', 'club', 'manual_payment',
    'content_release', 'content_draft', 'media_asset'));
