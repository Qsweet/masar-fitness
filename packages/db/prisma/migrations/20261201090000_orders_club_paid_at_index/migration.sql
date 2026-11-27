-- «نظرة عامة» v2 (ADMIN_REDESIGN §5.1، §8): الإيراد والطلبات المدفوعة بيوم الدفع لنادٍ في فترة. بلا هذا
-- الفهرس يقرأ الاستعلام كل طلبات النادي؛ معه مدى على (club_id, paid_at). الإنشاء في الفترة يستعمل
-- الفهرس القائم (club_id, created_at).
CREATE INDEX "orders_club_id_paid_at_idx" ON "orders"("club_id", "paid_at");
