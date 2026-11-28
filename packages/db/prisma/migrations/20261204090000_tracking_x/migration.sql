-- القرار 90-1: X (Twitter) منصة إعلانات خامسة في المتصفح وحده. تُقبل في إعداد الربط، ولا تدخل
-- الطابور الخادمي (قيد tracking_outbox_provider_server باقٍ على الأربع).
ALTER TABLE "tracking_integrations" DROP CONSTRAINT "tracking_integrations_provider_known";
ALTER TABLE "tracking_integrations" ADD CONSTRAINT "tracking_integrations_provider_known"
  CHECK ("provider" IN ('gtm', 'ga4', 'google_ads', 'meta', 'snap', 'tiktok', 'x'));
