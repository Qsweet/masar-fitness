-- القرار 91: إعلانات ChatGPT (OpenAI) منصة إعلانات سادسة، بالبكسل في المتصفح وبـConversions API من
-- الخادم (https://developers.openai.com/ads/conversions-api). تُقبل في الإعداد وفي الطابور الخادمي.
-- `obref` مرجع المتصفح من كوكي البكسل `__obref`، يُختم مع الطلب بموافقة الإعلانات ويُفرَّغ بعد 90 يومًا.
-- AlterTable
ALTER TABLE "order_tracking" ADD COLUMN     "obref" TEXT;

-- ═════════════ الجزء اليدوي ═════════════

ALTER TABLE "tracking_integrations" DROP CONSTRAINT "tracking_integrations_provider_known";
ALTER TABLE "tracking_integrations" ADD CONSTRAINT "tracking_integrations_provider_known"
  CHECK ("provider" IN ('gtm', 'ga4', 'google_ads', 'meta', 'snap', 'tiktok', 'x', 'openai'));

ALTER TABLE "tracking_outbox" DROP CONSTRAINT "tracking_outbox_provider_server";
ALTER TABLE "tracking_outbox" ADD CONSTRAINT "tracking_outbox_provider_server"
  CHECK ("provider" IN ('ga4', 'meta', 'snap', 'tiktok', 'openai'));

-- حد الطول كبقية كوكيات المنصات: القيمة من كوكي يكتبه المتصفح
ALTER TABLE "order_tracking" ADD CONSTRAINT "order_tracking_obref_length"
  CHECK (char_length(coalesce("obref", '')) <= 200);

-- الـtrigger نفسه (القرار 90-6) و`obref` في قائمة المعرّفات التي يصفّرها التفريغ؛ `oppref` داخل
-- اللمستين فتُسقطه `tracking_scrub_touch` كبقية معرّفات النقر.
CREATE OR REPLACE FUNCTION "order_tracking_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  identifiers CONSTANT text[] := ARRAY['ga_client_id', 'fbp', 'fbc', 'scid', 'ttp', 'obref',
    'client_ip', 'user_agent', 'page_url'];
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
