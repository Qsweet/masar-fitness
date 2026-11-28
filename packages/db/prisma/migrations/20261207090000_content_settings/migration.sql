-- الإعدادات المنظَّمة في مسودة المحتوى (ADMIN_A3_CONTENT §5، WP6–WP10، القرار 95). لا جدول جديد:
-- الإعداد صف واحد في content_draft_entries بمفتاح setting:<معرّف> ولغة '*' وقيمة كائن JSON، ويدخل
-- لقطة الإصدار تحت settings. هذا الترحيل يوسّع قيود CHECK الثلاثة وحدها؛ صفوف النصوص كما كانت.

ALTER TABLE "content_draft_entries"
  DROP CONSTRAINT "content_draft_entries_key_shape",
  DROP CONSTRAINT "content_draft_entries_locale_known",
  DROP CONSTRAINT "content_draft_entries_value_shape";

ALTER TABLE "content_draft_entries"
  -- مسار ورقة نصية بعد text:، أو معرّف إعداد (حروف ونقاط) بعد setting:
  ADD CONSTRAINT "content_draft_entries_key_shape"
    CHECK ((
        "entry_key" ~ '^text:[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$'
        OR "entry_key" ~ '^setting:[a-z][A-Za-z]*(\.[A-Za-z]+)*$'
      ) AND char_length("entry_key") <= 125),
  -- النص بلغته؛ الإعداد صف واحد بلغتيه معًا
  ADD CONSTRAINT "content_draft_entries_locale_known"
    CHECK (
      ("entry_key" LIKE 'text:%' AND "locale" IN ('ar', 'en'))
      OR ("entry_key" LIKE 'setting:%' AND "locale" = '*')),
  -- تجاوز نصي كما كان؛ أو كائن إعداد حتى 256 كيلوبايت (أطول إعداد: صفحة قانونية بثلاثين قسمًا)؛ أو NULL
  ADD CONSTRAINT "content_draft_entries_value_shape"
    CHECK ("value" IS NULL
      OR ("entry_key" LIKE 'text:%'
        AND jsonb_typeof("value") = 'object'
        AND jsonb_typeof("value"->'value') = 'string'
        AND char_length("value"->>'value') BETWEEN 1 AND 700
        AND ("value"->>'baseHash') ~ '^[0-9a-f]{64}$')
      OR ("entry_key" LIKE 'setting:%'
        AND jsonb_typeof("value") = 'object'
        AND octet_length("value"::text) <= 262144));
