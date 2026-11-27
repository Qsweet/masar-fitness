-- المرحلة A3 (مراجعة WP1–WP5، القرار 73): C1 يمنع TRUNCATE أيضًا. محفّزات الصف لا تعمل مع TRUNCATE،
-- فسجل الإصدارات كان يُفرَّغ كله بجملة واحدة. الترحيل المطبَّق لا يُعدَّل؛ هذا ترحيل جديد.
CREATE TRIGGER "content_releases_forbid_truncate" BEFORE TRUNCATE ON "content_releases"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_mutation"('content_release_immutable');
