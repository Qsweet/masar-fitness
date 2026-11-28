-- مراجعة القرار 93 (L1): `oppref` معرّف نقر OpenAI «opaque» لا نمط لمحارفه، فقيمة رابط خارج نمط
-- معرّفات النقر تسقط من اللمسة. هذا العمود يحفظ كوكي البكسل `__oppref` بموافقة الإعلانات بديلًا، بحد
-- طول 512 وبلا محارف تحكم، ويُفرَّغ بعد 90 يومًا كبقية المعرّفات.
-- AlterTable
ALTER TABLE "order_tracking" ADD COLUMN     "oppref" TEXT;

-- ═════════════ الجزء اليدوي ═════════════

ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_oppref_shape"
  CHECK ("oppref" IS NULL OR (char_length("oppref") BETWEEN 1 AND 512
    AND "oppref" !~ '[[:cntrl:]]'));

CREATE OR REPLACE FUNCTION "order_tracking_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  identifiers CONSTANT text[] := ARRAY['ga_client_id', 'fbp', 'fbc', 'scid', 'ttp', 'obref',
    'oppref', 'client_ip', 'user_agent', 'page_url'];
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
