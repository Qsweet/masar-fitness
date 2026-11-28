-- القرار 90-6: تقليل البيانات. معرّفات القياس المختومة مع الطلب تُفرَّغ بعد 90 يومًا من إنشائه
-- (`tracking:purge`)، ويبقى غير المعرِّف: الموافقة، ومعاملات الحملة utm_*، وصفحة الهبوط، والوقت.
-- AlterTable
ALTER TABLE "order_tracking" ADD COLUMN     "purged_at" TIMESTAMPTZ(3);

-- ═════════════ الجزء اليدوي ═════════════

-- اللمسة بعد التفريغ: الوقت وصفحة الهبوط ومعاملات الحملة وحدها (معرّفات النقر تُسقط)
CREATE FUNCTION "tracking_scrub_touch"(touch jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN touch IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
    'at', touch -> 'at',
    'landing', touch -> 'landing',
    'values', COALESCE((SELECT jsonb_object_agg(key, value) FROM jsonb_each(touch -> 'values')
      WHERE key LIKE 'utm\_%'), '{}'::jsonb))) END
$$;

-- ما خُتم مع الطلب ثابت، إلا انتقالًا واحدًا: التفريغ. يُقبل فقط إن كتب purged_at أول مرة، وصفّر كل
-- معرّف، ونظّف اللمستين بالدالة نفسها، ولم يمسّ غير ذلك (الموافقة والنادي والوقت).
CREATE FUNCTION "order_tracking_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  identifiers CONSTANT text[] := ARRAY['ga_client_id', 'fbp', 'fbc', 'scid', 'ttp', 'client_ip',
    'user_agent', 'page_url'];
  scrubbed CONSTANT text[] := identifiers || ARRAY['first_touch', 'last_touch', 'purged_at'];
BEGIN
  IF OLD."purged_at" IS NULL AND NEW."purged_at" IS NOT NULL
    AND (to_jsonb(NEW) - scrubbed) = (to_jsonb(OLD) - scrubbed)
    AND NOT EXISTS (SELECT 1 FROM unnest(identifiers) AS k WHERE to_jsonb(NEW) ->> k IS NOT NULL)
    AND NEW."first_touch" IS NOT DISTINCT FROM "tracking_scrub_touch"(OLD."first_touch")
    AND NEW."last_touch" IS NOT DISTINCT FROM "tracking_scrub_touch"(OLD."last_touch") THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'order_tracking_immutable';
END;
$$;

DROP TRIGGER "order_tracking_forbid_update" ON "order_tracking";
CREATE TRIGGER "order_tracking_guard_update" BEFORE UPDATE ON "order_tracking"
  FOR EACH ROW EXECUTE FUNCTION "order_tracking_guard_update"();

-- دفعات التفريغ تقرأ ما لم يُفرَّغ بعد وحده
CREATE INDEX "order_tracking_unpurged_idx" ON "order_tracking" ("created_at")
  WHERE "purged_at" IS NULL;
