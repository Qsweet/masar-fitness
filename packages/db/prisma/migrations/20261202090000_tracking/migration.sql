-- المرحلة A5: الربط والقياس (docs/ADMIN_A5_TRACKING.md §7). الجزء الأول مولَّد من schema.prisma، والجزء
-- اليدوي بعده: قيود CHECK، وفرادة الأحداث الحية، ومنع تعديل ما خُتم مع الطلب، وكيان التدقيق.
-- CreateTable
CREATE TABLE "tracking_integrations" (
    "club_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret_enc" TEXT,
    "secret_last4" TEXT,
    "test_event_code" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "tracking_integrations_pkey" PRIMARY KEY ("club_id","provider")
);

-- CreateTable
CREATE TABLE "order_tracking" (
    "order_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "consent_analytics" BOOLEAN NOT NULL,
    "consent_ads" BOOLEAN NOT NULL,
    "consent_version" INTEGER,
    "consent_at" TIMESTAMPTZ(3),
    "first_touch" JSONB,
    "last_touch" JSONB,
    "ga_client_id" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "scid" TEXT,
    "ttp" TEXT,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "page_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_tracking_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "tracking_outbox" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "order_id" UUID,
    "provider" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'live',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
    "last_status" INTEGER,
    "last_reason" TEXT,
    "event_time" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "tracking_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracking_outbox_status_next_attempt_at_idx" ON "tracking_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "tracking_outbox_club_id_created_at_idx" ON "tracking_outbox"("club_id", "created_at");

-- AddForeignKey
ALTER TABLE "tracking_integrations" ADD CONSTRAINT "tracking_integrations_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tracking_outbox" ADD CONSTRAINT "tracking_outbox_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tracking_outbox" ADD CONSTRAINT "tracking_outbox_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ═════════════ الجزء اليدوي: قيود CHECK ═════════════

ALTER TABLE "tracking_integrations"
  -- المنصات قائمة مغلقة (TRACKING_PROVIDERS في المجال)
  ADD CONSTRAINT "tracking_integrations_provider_known"
    CHECK ("provider" IN ('gtm', 'ga4', 'google_ads', 'meta', 'snap', 'tiktok')),
  ADD CONSTRAINT "tracking_integrations_config_object" CHECK (jsonb_typeof("config") = 'object'),
  -- المفتاح المشفّر بصيغة sealSecret (v1.<iv>.<tag>.<نص>)، وآخر أربعة معه دائمًا أو بدونه دائمًا
  ADD CONSTRAINT "tracking_integrations_secret_shape"
    CHECK (("secret_enc" IS NULL AND "secret_last4" IS NULL)
      OR ("secret_enc" ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
        AND char_length("secret_enc") <= 4096 AND char_length("secret_last4") = 4)),
  ADD CONSTRAINT "tracking_integrations_test_code_shape"
    CHECK ("test_event_code" IS NULL OR "test_event_code" ~ '^[A-Za-z0-9_-]{4,40}$');

ALTER TABLE "order_tracking"
  ADD CONSTRAINT "order_tracking_touch_object"
    CHECK (("first_touch" IS NULL OR jsonb_typeof("first_touch") = 'object')
      AND ("last_touch" IS NULL OR jsonb_typeof("last_touch") = 'object')),
  -- حدود الطول: القيم من كوكيات وترويسات يكتبها المتصفح
  ADD CONSTRAINT "order_tracking_lengths"
    CHECK (char_length(coalesce("ga_client_id", '')) <= 64
      AND char_length(coalesce("fbp", '')) <= 600 AND char_length(coalesce("fbc", '')) <= 600
      AND char_length(coalesce("scid", '')) <= 200 AND char_length(coalesce("ttp", '')) <= 200
      AND char_length(coalesce("client_ip", '')) <= 64
      AND char_length(coalesce("user_agent", '')) <= 512
      AND char_length(coalesce("page_url", '')) <= 2048);

ALTER TABLE "tracking_outbox"
  ADD CONSTRAINT "tracking_outbox_provider_server"
    CHECK ("provider" IN ('ga4', 'meta', 'snap', 'tiktok')),
  ADD CONSTRAINT "tracking_outbox_kind_known" CHECK ("kind" IN ('live', 'test')),
  ADD CONSTRAINT "tracking_outbox_status_known"
    CHECK ("status" IN ('pending', 'sent', 'dead', 'skipped')),
  -- الحدث الحي لطلب، والاختبار بلا طلب
  ADD CONSTRAINT "tracking_outbox_kind_order"
    CHECK (("kind" = 'live') = ("order_id" IS NOT NULL)),
  ADD CONSTRAINT "tracking_outbox_attempts_range" CHECK ("attempts" BETWEEN 0 AND 20),
  ADD CONSTRAINT "tracking_outbox_reason_shape"
    CHECK ("last_reason" IS NULL OR "last_reason" ~ '^[a-z0-9_]{1,64}$'),
  ADD CONSTRAINT "tracking_outbox_event_shape"
    CHECK ("event_name" ~ '^[A-Za-z_]{1,40}$' AND char_length("event_id") BETWEEN 1 AND 80);

-- مرة لكل حدث حي ومنصة (الإدراج ON CONFLICT DO NOTHING): الإعادة لا تكرر الشراء
CREATE UNIQUE INDEX "tracking_outbox_live_event_key" ON "tracking_outbox"
  ("club_id", "provider", "event_name", "event_id") WHERE "kind" = 'live';
CREATE INDEX "tracking_outbox_order_id_idx" ON "tracking_outbox"("order_id");

-- ما خُتم مع الطلب لا يتغير (الحذف ممنوع بـFK الطلب أصلًا)
CREATE TRIGGER "order_tracking_forbid_update" BEFORE UPDATE ON "order_tracking"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('order_tracking_immutable');

-- التدقيق يقبل إعداد الربط (إسقاط وإعادة إنشاء كالسابقات)
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_entity_type_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_type_known"
  CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request', 'payment_attempt',
    'staff_user', 'product', 'promotion', 'customer', 'club', 'manual_payment',
    'content_release', 'content_draft', 'media_asset', 'content_slide', 'tracking_integration'));
