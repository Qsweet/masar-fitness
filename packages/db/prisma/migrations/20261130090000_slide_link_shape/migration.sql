-- مراجعة الشريط (القرار 77): المسار الداخلي بشكل صارم. القيد السابق قبل `/\evil.com` (المتصفح يقرؤه
-- رابطًا إلى موقع آخر) و`%5c`. الترحيل المطبَّق لا يُعدَّل؛ هذا ترحيل جديد يسقط القيد ويعيده.
ALTER TABLE "content_slides" DROP CONSTRAINT "content_slides_link_shape";
ALTER TABLE "content_slides" ADD CONSTRAINT "content_slides_link_shape" CHECK (
  ("link_kind" = 'none' AND "link_target" = '' AND NOT "link_new_tab" AND "click_target" = 'button')
  OR ("link_kind" = 'internal' AND "link_target" ~ '^/[a-z0-9/_#-]*$' AND "link_target" !~ '//'
    AND char_length("link_target") <= 200 AND NOT "link_new_tab")
  OR ("link_kind" = 'external' AND "link_target" ~ '^https://[a-z0-9]'
    AND "link_target" !~ '[\\[:space:]]' AND char_length("link_target") <= 500));
