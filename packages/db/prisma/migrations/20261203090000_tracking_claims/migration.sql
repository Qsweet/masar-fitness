-- مراجعة A5 (القرار 89): رمز حجز لكل دفعة في الطابور، فلا يسجّل مرسِل انقضت مهلته نتيجة فوق غيره،
-- وسجل «أول عرض» لصفحة الطلب المدفوع الذي حمل الجوال المجزّأ إلى المتصفح (مرة لكل طلب).
-- AlterTable
ALTER TABLE "tracking_outbox" ADD COLUMN     "claim_token" UUID;

-- CreateTable
CREATE TABLE "tracking_browser_purchases" (
    "order_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tracking_browser_purchases_pkey" PRIMARY KEY ("order_id")
);

-- AddForeignKey
ALTER TABLE "tracking_browser_purchases" ADD CONSTRAINT "tracking_browser_purchases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

