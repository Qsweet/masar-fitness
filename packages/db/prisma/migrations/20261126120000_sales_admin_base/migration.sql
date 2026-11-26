-- المرحلة A2 (WP1): أساس إدارة المبيعات (docs/ADMIN_A2_SALES.md §3).

-- CreateIndex: قائمة الطلبات في اللوحة تقرأ الأحدث أولًا لكل نادٍ، مع مدى زمني على الإنشاء
CREATE INDEX "orders_club_id_created_at_idx" ON "orders"("club_id", "created_at");

-- التدقيق يقبل كيانات المبيعات: المنتج والعرض والعميل والنادي والدفعة اليدوية (إسقاط وإعادة إنشاء
-- كسابقة ترحيلَي الدفع والموظفين)
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_entity_type_known";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_entity_type_known"
  CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request', 'payment_attempt',
    'staff_user', 'product', 'promotion', 'customer', 'club', 'manual_payment'));
