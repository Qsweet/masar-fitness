-- المرحلة A3 (WP3): مسودة المحتوى (docs/ADMIN_A3_CONTENT.md §8.2). الجزء الأول مولَّد من schema.prisma،
-- والجزء اليدوي بعده: قيود الشكل. الإعدادات المنظَّمة (setting:) تُضاف إلى القيد مع حزمتها (WP6).

-- CreateTable
CREATE TABLE "content_draft_entries" (
    "club_id" UUID NOT NULL,
    "entry_key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" JSONB,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_draft_entries_pkey" PRIMARY KEY ("club_id","entry_key","locale")
);

-- AddForeignKey
ALTER TABLE "content_draft_entries" ADD CONSTRAINT "content_draft_entries_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "content_draft_entries" ADD CONSTRAINT "content_draft_entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;



-- ═════════════ الجزء اليدوي ═════════════

ALTER TABLE "content_draft_entries"
  -- مسار ورقة نصية بشكل المجال (CONTENT_PATH_SHAPE) بعد البادئة text:
  ADD CONSTRAINT "content_draft_entries_key_shape"
    CHECK ("entry_key" ~ '^text:[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$' AND char_length("entry_key") <= 125),
  ADD CONSTRAINT "content_draft_entries_locale_known" CHECK ("locale" IN ('ar', 'en')),
  -- تجاوز نصي: كائن بنص غير فارغ حتى 700 محرف (أطول نوع) وبصمة افتراضي SHA-256؛ أو NULL للعودة
  ADD CONSTRAINT "content_draft_entries_value_shape"
    CHECK ("value" IS NULL OR (
      jsonb_typeof("value") = 'object'
      AND jsonb_typeof("value"->'value') = 'string'
      AND char_length("value"->>'value') BETWEEN 1 AND 700
      AND ("value"->>'baseHash') ~ '^[0-9a-f]{64}$'));
