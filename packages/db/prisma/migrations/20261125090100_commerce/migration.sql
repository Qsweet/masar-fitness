-- المرحلة 3: محرك بيع الاشتراكات بلا دفع حي (docs/PHASE3_COMMERCE_DESIGN.md).
-- الجزء الأول مولَّد من schema.prisma (مع تعديلين يدويين معلَّمين: تعبئة clubs.vat_rate_bps والتسلسل)،
-- والجزء الثاني يدوي في آخر الملف: قيود CHECK ودوال trigger، لأن Prisma لا يعبّر عنها.
-- بوابة Prisma 7.10: المفاتيح المركّبة FK1..FK7 كلها مقبولة في schema.prisma، فلا بديل trigger لها (القرار 34).

-- CreateEnum
CREATE TYPE "membership_start_rule" AS ENUM ('on_payment', 'on_first_visit');

-- CreateEnum
CREATE TYPE "promotion_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "discount_kind" AS ENUM ('percentage', 'fixed_amount');

-- CreateEnum
CREATE TYPE "promotion_audience" AS ENUM ('anyone', 'new_customer', 'existing_customer');

-- CreateEnum
CREATE TYPE "promotion_scope" AS ENUM ('all_products', 'listed_products');

-- CreateEnum
CREATE TYPE "discount_source" AS ENUM ('automatic', 'coupon');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending_payment', 'paid', 'fulfilled', 'expired', 'cancelled', 'partially_refunded', 'refunded');

-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('scheduled', 'active', 'frozen', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('requested', 'approved', 'rejected', 'processing', 'completed', 'failed');

-- AlterTable (معدَّل يدويًا: العمود يُضاف فارغًا ثم يُعبَّأ ثم يُجعل NOT NULL، بلا DEFAULT)
ALTER TABLE "clubs" ADD COLUMN     "membership_start_rule" "membership_start_rule",
ADD COLUMN     "order_payment_window_minutes" INTEGER,
ADD COLUMN     "vat_rate_bps" INTEGER;

-- تعبئة بيانات لمرة واحدة: نسبة ضريبة القيمة المضافة النظامية 15% الموثقة حقيقةً في docs/SECURITY.md.
-- لا قيمة افتراضية في الكود ولا في العمود: كل نادٍ جديد يُنشأ بنسبة صريحة.
-- المهلة وقاعدة البدء تبقيان NULL عمدًا (غير محسومتين): لا يُنشأ أي طلب حتى يحسمهما المالك.
UPDATE "clubs" SET "vat_rate_bps" = 1500;

ALTER TABLE "clubs" ALTER COLUMN "vat_rate_bps" SET NOT NULL;

-- CreateTable
CREATE TABLE "product_addons" (
    "membership_product_id" UUID NOT NULL,
    "membership_kind" "product_kind" NOT NULL DEFAULT 'membership',
    "addon_product_id" UUID NOT NULL,
    "addon_kind" "product_kind" NOT NULL DEFAULT 'addon',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_addons_pkey" PRIMARY KEY ("membership_product_id","addon_product_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "code" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "status" "promotion_status" NOT NULL DEFAULT 'draft',
    "discount_kind" "discount_kind" NOT NULL,
    "percent_bps" INTEGER,
    "amount_minor" INTEGER,
    "currency" CHAR(3),
    "audience" "promotion_audience" NOT NULL,
    "scope" "promotion_scope" NOT NULL,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "max_redemptions" INTEGER,
    "max_redemptions_per_customer" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_products" (
    "promotion_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "promotion_products_pkey" PRIMARY KEY ("promotion_id","product_id")
);

-- CreateSequence (يدوي، قبل جدول orders لأن افتراضي reference يستعمله).
-- MAXVALUE يطابق المحارف السبعة في افتراضي reference: lpad يقصّ الأطول بصمت، فالأولى أن يفشل التسلسل صراحةً.
CREATE SEQUENCE "order_reference_seq" AS integer START 1000 MAXVALUE 9999999;

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "reference" TEXT NOT NULL DEFAULT ('MSR-'::text || lpad((nextval('order_reference_seq'::regclass))::text, 7, '0'::text)),
    "public_token" TEXT NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone_e164" TEXT NOT NULL,
    "locale" CHAR(2) NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'pending_payment',
    "currency" CHAR(3) NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "vat_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "paid_provider" TEXT,
    "paid_provider_payment_id" TEXT,
    "paid_amount_minor" INTEGER,
    "paid_currency" CHAR(3),
    "fulfilled_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "kind" "product_kind" NOT NULL,
    "product_id" UUID NOT NULL,
    "product_version_id" UUID NOT NULL,
    "product_slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "summary_ar" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "benefits" JSONB NOT NULL,
    "duration_months" INTEGER,
    "bonus_months" INTEGER NOT NULL,
    "membership_start_rule" "membership_start_rule",
    "currency" CHAR(3) NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL,
    "list_price_minor" INTEGER NOT NULL,
    "discount_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "vat_minor" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_discounts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "source" "discount_source" NOT NULL,
    "code" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "discount_kind" "discount_kind" NOT NULL,
    "percent_bps" INTEGER,
    "fixed_amount_minor" INTEGER,
    "sequence" SMALLINT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "order_paid_at" TIMESTAMPTZ(3) NOT NULL,
    "item_kind" "product_kind" NOT NULL DEFAULT 'membership',
    "paid_months" INTEGER NOT NULL,
    "bonus_months" INTEGER NOT NULL,
    "start_rule" "membership_start_rule" NOT NULL,
    "status" "membership_status" NOT NULL,
    "starts_on" DATE,
    "ends_on" DATE,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "status" "refund_status" NOT NULL DEFAULT 'requested',
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "provider_refund_id" TEXT,
    "requested_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_requests" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_kind" "product_kind" NOT NULL DEFAULT 'assessed_service',
    "customer_name" TEXT NOT NULL,
    "customer_phone_e164" TEXT NOT NULL,
    "locale" CHAR(2) NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT,
    "actor" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_club_id_phone_e164_key" ON "customers"("club_id", "phone_e164");

-- CreateIndex
CREATE INDEX "promotions_club_id_status_starts_at_idx" ON "promotions"("club_id", "status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_club_id_code_key" ON "promotions"("club_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_token_key" ON "orders"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_status_expires_at_idx" ON "orders"("status", "expires_at");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_paid_provider_paid_provider_payment_id_key" ON "orders"("paid_provider", "paid_provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_customer_id_key" ON "orders"("id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_paid_at_key" ON "orders"("id", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_position_key" ON "order_items"("order_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_id_order_id_kind_key" ON "order_items"("id", "order_id", "kind");

-- CreateIndex
CREATE INDEX "order_discounts_promotion_id_customer_id_idx" ON "order_discounts"("promotion_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_discounts_order_id_source_key" ON "order_discounts"("order_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "order_discounts_order_id_sequence_key" ON "order_discounts"("order_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "order_discounts_order_id_promotion_id_key" ON "order_discounts"("order_id", "promotion_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_order_id_key" ON "memberships"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_order_item_id_key" ON "memberships"("order_item_id");

-- CreateIndex
CREATE INDEX "memberships_customer_id_status_idx" ON "memberships"("customer_id", "status");

-- CreateIndex
CREATE INDEX "memberships_status_ends_on_idx" ON "memberships"("status", "ends_on");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_provider_provider_refund_id_key" ON "refunds"("provider", "provider_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_requests_idempotency_key_key" ON "assessment_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "assessment_requests_customer_id_created_at_idx" ON "assessment_requests"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_versions_id_product_id_price_minor_currency_bonus_m_key" ON "product_versions"("id", "product_id", "price_minor", "currency", "bonus_months");

-- CreateIndex
CREATE UNIQUE INDEX "product_versions_id_duration_months_key" ON "product_versions"("id", "duration_months");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_kind_key" ON "products"("id", "kind");

-- AddForeignKey
ALTER TABLE "product_addons" ADD CONSTRAINT "product_addons_membership_product_id_membership_kind_fkey" FOREIGN KEY ("membership_product_id", "membership_kind") REFERENCES "products"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_addons" ADD CONSTRAINT "product_addons_addon_product_id_addon_kind_fkey" FOREIGN KEY ("addon_product_id", "addon_kind") REFERENCES "products"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_version_id_product_id_list_price_minor_fkey" FOREIGN KEY ("product_version_id", "product_id", "list_price_minor", "currency", "bonus_months") REFERENCES "product_versions"("id", "product_id", "price_minor", "currency", "bonus_months") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_version_id_duration_months_fkey" FOREIGN KEY ("product_version_id", "duration_months") REFERENCES "product_versions"("id", "duration_months") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_kind_fkey" FOREIGN KEY ("product_id", "kind") REFERENCES "products"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_customer_id_fkey" FOREIGN KEY ("order_id", "customer_id") REFERENCES "orders"("id", "customer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_order_item_id_order_id_item_kind_fkey" FOREIGN KEY ("order_item_id", "order_id", "item_kind") REFERENCES "order_items"("id", "order_id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_order_id_order_paid_at_fkey" FOREIGN KEY ("order_id", "order_paid_at") REFERENCES "orders"("id", "paid_at") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "assessment_requests" ADD CONSTRAINT "assessment_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "assessment_requests" ADD CONSTRAINT "assessment_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "assessment_requests" ADD CONSTRAINT "assessment_requests_product_id_product_kind_fkey" FOREIGN KEY ("product_id", "product_kind") REFERENCES "products"("id", "kind") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- ═════════════ الجزء اليدوي: قيود CHECK (الاسم <table>_<rule>) ═════════════

ALTER TABLE "clubs"
  ADD CONSTRAINT "clubs_vat_rate_range" CHECK ("vat_rate_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "clubs_order_payment_window_positive" CHECK ("order_payment_window_minutes" > 0);

ALTER TABLE "product_addons"
  ADD CONSTRAINT "product_addons_membership_kind" CHECK ("membership_kind" = 'membership'),
  ADD CONSTRAINT "product_addons_addon_kind" CHECK ("addon_kind" = 'addon');

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_phone_shape" CHECK ("phone_e164" ~ '^\+9665[0-9]{8}$');

ALTER TABLE "promotions"
  ADD CONSTRAINT "promotions_code_shape" CHECK ("code" ~ '^[A-Z0-9]{3,32}$'),
  ADD CONSTRAINT "promotions_discount_shape" CHECK (
    ("discount_kind" = 'percentage' AND "percent_bps" BETWEEN 1 AND 10000
      AND "amount_minor" IS NULL AND "currency" IS NULL)
    OR ("discount_kind" = 'fixed_amount' AND "amount_minor" > 0
      AND "currency" IS NOT NULL AND "percent_bps" IS NULL)),
  ADD CONSTRAINT "promotions_window_ordered" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
  ADD CONSTRAINT "promotions_max_redemptions_positive" CHECK ("max_redemptions" IS NULL OR "max_redemptions" > 0),
  ADD CONSTRAINT "promotions_max_per_customer_positive"
    CHECK ("max_redemptions_per_customer" IS NULL OR "max_redemptions_per_customer" > 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_public_token_length" CHECK (char_length("public_token") = 43),
  ADD CONSTRAINT "orders_reference_shape" CHECK ("reference" ~ '^MSR-[0-9]{7,}$'),
  ADD CONSTRAINT "orders_locale_supported" CHECK ("locale" IN ('ar', 'en')),
  ADD CONSTRAINT "orders_vat_rate_range" CHECK ("vat_rate_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "orders_subtotal_non_negative" CHECK ("subtotal_minor" >= 0),
  ADD CONSTRAINT "orders_discount_non_negative" CHECK ("discount_minor" >= 0),
  -- لا طلب بإجمالي صفر: لا تفعيل بلا دفعة متحقق منها
  ADD CONSTRAINT "orders_total_positive" CHECK ("total_minor" > 0),
  ADD CONSTRAINT "orders_total_balanced" CHECK ("total_minor" = "subtotal_minor" - "discount_minor"),
  ADD CONSTRAINT "orders_vat_range" CHECK ("vat_minor" BETWEEN 0 AND "total_minor"),
  ADD CONSTRAINT "orders_expiry_after_creation" CHECK ("expires_at" > "created_at"),
  -- أعمدة التسوية الخمسة تُكتب معًا أو لا تُكتب
  ADD CONSTRAINT "orders_payment_complete" CHECK (
    num_nonnulls("paid_at", "paid_provider", "paid_provider_payment_id", "paid_amount_minor", "paid_currency") IN (0, 5)),
  -- القيم الفارغة تمرّ قبل الدفع، وبعده يطابق المبلغ والعملة الطلب تمامًا
  ADD CONSTRAINT "orders_payment_matches" CHECK ("paid_amount_minor" = "total_minor" AND "paid_currency" = "currency"),
  ADD CONSTRAINT "orders_paid_state"
    CHECK (("status" IN ('pending_payment', 'expired', 'cancelled')) = ("paid_at" IS NULL)),
  ADD CONSTRAINT "orders_expired_state" CHECK (("status" = 'expired') = ("expired_at" IS NOT NULL)),
  ADD CONSTRAINT "orders_expired_after_deadline" CHECK ("expired_at" IS NULL OR "expired_at" >= "expires_at"),
  ADD CONSTRAINT "orders_cancelled_state" CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL)),
  ADD CONSTRAINT "orders_fulfilled_state" CHECK ("status" <> 'fulfilled' OR "fulfilled_at" IS NOT NULL),
  ADD CONSTRAINT "orders_fulfilled_after_payment" CHECK ("fulfilled_at" IS NULL OR "paid_at" IS NOT NULL),
  ADD CONSTRAINT "orders_paid_provider_shape" CHECK ("paid_provider" ~ '^[a-z][a-z0-9_]{1,31}$'),
  ADD CONSTRAINT "orders_customer_phone_shape" CHECK ("customer_phone_e164" ~ '^\+9665[0-9]{8}$'),
  ADD CONSTRAINT "orders_customer_name_length" CHECK (char_length(btrim("customer_name")) BETWEEN 2 AND 120);

ALTER TABLE "order_items"
  -- سطر أساسي وخمس إضافات على الأكثر (MAX_ADDONS_PER_ORDER في المجال)
  ADD CONSTRAINT "order_items_position_range" CHECK ("position" BETWEEN 0 AND 5),
  -- الخدمة بتقييم لا تدخل طلبًا
  ADD CONSTRAINT "order_items_kind_sellable" CHECK ("kind" IN ('membership', 'digital_program', 'addon')),
  ADD CONSTRAINT "order_items_primary_position" CHECK (("position" = 0) = ("kind" <> 'addon')),
  ADD CONSTRAINT "order_items_duration_for_membership"
    CHECK (("kind" = 'membership') = ("duration_months" IS NOT NULL)),
  ADD CONSTRAINT "order_items_start_rule_for_membership"
    CHECK (("kind" = 'membership') = ("membership_start_rule" IS NOT NULL)),
  ADD CONSTRAINT "order_items_vat_rate_range" CHECK ("vat_rate_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "order_items_list_price_non_negative" CHECK ("list_price_minor" >= 0),
  ADD CONSTRAINT "order_items_discount_range" CHECK ("discount_minor" BETWEEN 0 AND "list_price_minor"),
  ADD CONSTRAINT "order_items_total_balanced" CHECK ("total_minor" = "list_price_minor" - "discount_minor"),
  -- الضريبة المستخرجة من السعر الشامل بالنصف يُرفع، الصيغة نفسها في المجال (mulDivHalfUp)
  ADD CONSTRAINT "order_items_vat_formula" CHECK ("vat_minor" = (
    ("total_minor"::bigint * "vat_rate_bps" * 2 + (10000 + "vat_rate_bps"))
      / (2 * (10000 + "vat_rate_bps")))::integer),
  ADD CONSTRAINT "order_items_benefits_array" CHECK (jsonb_typeof("benefits") = 'array');

ALTER TABLE "order_discounts"
  ADD CONSTRAINT "order_discounts_sequence_range" CHECK ("sequence" IN (1, 2)),
  ADD CONSTRAINT "order_discounts_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "order_discounts_code_for_coupon" CHECK (("source" = 'coupon') = ("code" IS NOT NULL));

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_item_kind_membership" CHECK ("item_kind" = 'membership'),
  ADD CONSTRAINT "memberships_paid_months_positive" CHECK ("paid_months" > 0),
  ADD CONSTRAINT "memberships_bonus_months_non_negative" CHECK ("bonus_months" >= 0),
  ADD CONSTRAINT "memberships_period_complete" CHECK (("starts_on" IS NULL) = ("ends_on" IS NULL)),
  -- أشهر ميلادية تقويمية مع قصّ آخر الشهر، و ends_on أول يوم بعد المدة؛ يطابق addMonthsClamped في المجال
  ADD CONSTRAINT "memberships_period_length" CHECK ("starts_on" IS NULL
    OR "ends_on" = ("starts_on" + make_interval(months => "paid_months" + "bonus_months"))::date),
  ADD CONSTRAINT "memberships_started_state"
    CHECK ("status" NOT IN ('active', 'frozen', 'expired') OR "starts_on" IS NOT NULL),
  ADD CONSTRAINT "memberships_cancelled_state" CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL));

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "refunds_decided_state" CHECK (("status" = 'requested') = ("decided_at" IS NULL)),
  ADD CONSTRAINT "refunds_completed_state" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL));

ALTER TABLE "assessment_requests"
  ADD CONSTRAINT "assessment_requests_product_kind" CHECK ("product_kind" = 'assessed_service'),
  ADD CONSTRAINT "assessment_requests_locale_supported" CHECK ("locale" IN ('ar', 'en')),
  ADD CONSTRAINT "assessment_requests_customer_phone_shape" CHECK ("customer_phone_e164" ~ '^\+9665[0-9]{8}$'),
  ADD CONSTRAINT "assessment_requests_customer_name_length"
    CHECK (char_length(btrim("customer_name")) BETWEEN 2 AND 120);

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_entity_type_known"
    CHECK ("entity_type" IN ('order', 'membership', 'refund', 'assessment_request')),
  ADD CONSTRAINT "audit_logs_actor_known" CHECK ("actor" IN ('system', 'customer', 'staff', 'provider'));

-- ═════════════ الجزء اليدوي: دوال trigger ═════════════
-- كل رسالة استثناء نص ثابت يطابقه الكود والاختبارات. لا جدول انتقالات هنا: الجداول في المجال فقط،
-- والقاعدة تفرض الثوابت الخشنة (النهائي نهائي، لا عودة إلى pending_payment، paid_* تُكتب مرة).

-- T1: سجلات للإلحاق فقط. الرسالة الثابتة هي وسيط الـtrigger.
CREATE FUNCTION "forbid_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = TG_ARGV[0];
END;
$$;

CREATE TRIGGER "order_items_forbid_mutation" BEFORE UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('order_snapshot_immutable');
CREATE TRIGGER "order_discounts_forbid_mutation" BEFORE UPDATE OR DELETE ON "order_discounts"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('order_snapshot_immutable');
CREATE TRIGGER "audit_logs_forbid_mutation" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('audit_log_append_only');
CREATE TRIGGER "assessment_requests_forbid_mutation" BEFORE UPDATE OR DELETE ON "assessment_requests"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('assessment_request_immutable');
CREATE TRIGGER "orders_forbid_delete" BEFORE DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('order_delete_forbidden');
CREATE TRIGGER "memberships_forbid_delete" BEFORE DELETE ON "memberships"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('membership_delete_forbidden');
CREATE TRIGGER "refunds_forbid_delete" BEFORE DELETE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('refund_delete_forbidden');
CREATE TRIGGER "customers_forbid_delete" BEFORE DELETE ON "customers"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"('customer_delete_forbidden');

-- T2: الطلب لقطة. كل عمود ثابت عدا الحالة والتسوية وأوقات الانتقال، فأي عمود لقطة يُضاف لاحقًا ثابت افتراضيًا.
CREATE FUNCTION "orders_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mutable CONSTANT text[] := ARRAY['status', 'paid_at', 'paid_provider', 'paid_provider_payment_id',
    'paid_amount_minor', 'paid_currency', 'fulfilled_at', 'expired_at', 'cancelled_at'];
BEGIN
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'order_snapshot_immutable';
  END IF;
  IF OLD.paid_at IS NOT NULL AND
     (NEW.paid_at, NEW.paid_provider, NEW.paid_provider_payment_id, NEW.paid_amount_minor, NEW.paid_currency)
     IS DISTINCT FROM
     (OLD.paid_at, OLD.paid_provider, OLD.paid_provider_payment_id, OLD.paid_amount_minor, OLD.paid_currency) THEN
    RAISE EXCEPTION 'order_payment_immutable';
  END IF;
  IF OLD.status IN ('expired', 'cancelled', 'refunded') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'order_status_final';
  END IF;
  IF NEW.status = 'pending_payment' AND OLD.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'order_status_no_return';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_guard_update" BEFORE UPDATE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "orders_guard_update"();

-- T3: مجاميع الرأس تطابق السطور والخصومات عند COMMIT (مؤجَّل، فالإدراج بأي ترتيب داخل المعاملة).
CREATE FUNCTION "orders_assert_totals"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target uuid;
  head record;
  items record;
  discounts bigint;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN target := NEW.id; ELSE target := NEW.order_id; END IF;
  SELECT currency, vat_rate_bps, subtotal_minor, discount_minor, total_minor, vat_minor
    INTO head FROM "orders" WHERE id = target;
  SELECT count(*) FILTER (WHERE position = 0) AS primaries,
         coalesce(bool_or(kind = 'addon'), false) AS has_addon,
         coalesce(bool_or(position = 0 AND kind = 'membership'), false) AS membership_primary,
         coalesce(bool_and(currency = head.currency AND vat_rate_bps = head.vat_rate_bps), true) AS uniform,
         coalesce(sum(list_price_minor), 0) AS list, coalesce(sum(discount_minor), 0) AS discount,
         coalesce(sum(total_minor), 0) AS total, coalesce(sum(vat_minor), 0) AS vat
    INTO items FROM "order_items" WHERE order_id = target;
  SELECT coalesce(sum(amount_minor), 0) INTO discounts FROM "order_discounts" WHERE order_id = target;
  IF items.primaries <> 1 THEN
    RAISE EXCEPTION 'order_primary_item_required';
  END IF;
  IF items.has_addon AND NOT items.membership_primary THEN
    RAISE EXCEPTION 'order_addon_requires_membership';
  END IF;
  IF NOT items.uniform THEN
    RAISE EXCEPTION 'order_item_terms_mismatch';
  END IF;
  IF items.list <> head.subtotal_minor OR items.discount <> head.discount_minor
     OR discounts <> head.discount_minor OR items.total <> head.total_minor OR items.vat <> head.vat_minor THEN
    RAISE EXCEPTION 'order_totals_mismatch';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "orders_assert_totals" AFTER INSERT ON "orders"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "orders_assert_totals"();
CREATE CONSTRAINT TRIGGER "order_items_assert_totals" AFTER INSERT ON "order_items"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "orders_assert_totals"();
CREATE CONSTRAINT TRIGGER "order_discounts_assert_totals" AFTER INSERT ON "order_discounts"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "orders_assert_totals"();

-- T4: حد الكوبون يُعاد عدّه تحت قفل صف العرض عند كل إدراج، فلا يُتجاوز ولو تخطّى الكود قفله.
-- الاستخدام «نشط» ما دام طلبه ليس expired ولا cancelled.
CREATE FUNCTION "order_discounts_redemption_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  promo record;
  used_total bigint;
  used_by_customer bigint;
BEGIN
  SELECT max_redemptions, max_redemptions_per_customer INTO promo
    FROM "promotions" WHERE id = NEW.promotion_id FOR UPDATE;
  SELECT count(*), count(*) FILTER (WHERE d.customer_id = NEW.customer_id)
    INTO used_total, used_by_customer
    FROM "order_discounts" d JOIN "orders" o ON o.id = d.order_id
   WHERE d.promotion_id = NEW.promotion_id AND o.status NOT IN ('expired', 'cancelled');
  IF used_total >= promo.max_redemptions OR used_by_customer >= promo.max_redemptions_per_customer THEN
    RAISE EXCEPTION 'promotion_redemption_limit'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'promotion_redemption_limit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "order_discounts_redemption_limit" BEFORE INSERT ON "order_discounts"
  FOR EACH ROW EXECUTE FUNCTION "order_discounts_redemption_limit"();

-- T5a: شروط النسخة التجارية لا تتغير أبدًا (تغيير السعر = نسخة جديدة). valid_until وحده قابل للتعديل.
CREATE FUNCTION "product_versions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.product_id, NEW.price_minor, NEW.currency, NEW.duration_months, NEW.bonus_months,
      NEW.valid_from, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.product_id, OLD.price_minor, OLD.currency, OLD.duration_months, OLD.bonus_months,
      OLD.valid_from, OLD.created_at) THEN
    RAISE EXCEPTION 'product_version_terms_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "product_versions_guard" BEFORE UPDATE ON "product_versions"
  FOR EACH ROW EXECUTE FUNCTION "product_versions_guard"();

-- T5b: مزايا النسخة المباعة ثابتة. يقفل النسخة الأم (أو النسختين عند تغيير version_id) بترتيب المعرّف،
-- ثم يرفض إن وُجد سطر طلب لها. إن لم توجد الأم فهو حذف متسلسل لنسخة غير مباعة فيُقبل.
CREATE FUNCTION "product_benefits_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  versions uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    versions := ARRAY[NEW.version_id];
  ELSIF TG_OP = 'DELETE' THEN
    versions := ARRAY[OLD.version_id];
  ELSE
    versions := ARRAY[OLD.version_id, NEW.version_id];
  END IF;
  PERFORM 1 FROM "product_versions" WHERE id = ANY(versions) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "order_items" WHERE product_version_id = ANY(versions)) THEN
    RAISE EXCEPTION 'product_version_benefits_frozen';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "product_benefits_guard" BEFORE INSERT OR UPDATE OR DELETE ON "product_benefits"
  FOR EACH ROW EXECUTE FUNCTION "product_benefits_guard"();

-- T6: الاشتراك يطابق لقطة سطره وطلبه عند الإدراج. بعده: المراجع والأشهر وقاعدة البدء ثابتة،
-- والفترة لا تتغير بعد تعيينها (لا تمديد حتى تُحسم قواعد التجميد)، و expired و cancelled نهائيتان.
CREATE FUNCTION "memberships_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  snap record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT i.duration_months, i.bonus_months, i.membership_start_rule, o.customer_id, o.club_id INTO snap
      FROM "order_items" i JOIN "orders" o ON o.id = i.order_id
     WHERE i.id = NEW.order_item_id AND i.order_id = NEW.order_id;
    IF NOT FOUND OR (NEW.paid_months, NEW.bonus_months, NEW.start_rule, NEW.customer_id, NEW.club_id)
       IS DISTINCT FROM (snap.duration_months, snap.bonus_months, snap.membership_start_rule,
                         snap.customer_id, snap.club_id) THEN
      RAISE EXCEPTION 'membership_snapshot_mismatch';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.id, NEW.club_id, NEW.customer_id, NEW.order_id, NEW.order_item_id, NEW.order_paid_at, NEW.item_kind,
      NEW.paid_months, NEW.bonus_months, NEW.start_rule, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.club_id, OLD.customer_id, OLD.order_id, OLD.order_item_id, OLD.order_paid_at, OLD.item_kind,
      OLD.paid_months, OLD.bonus_months, OLD.start_rule, OLD.created_at)
     OR (OLD.starts_on IS NOT NULL AND (NEW.starts_on, NEW.ends_on) IS DISTINCT FROM (OLD.starts_on, OLD.ends_on)) THEN
    RAISE EXCEPTION 'membership_terms_immutable';
  END IF;
  IF OLD.status IN ('expired', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'membership_status_final';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "memberships_guard" BEFORE INSERT OR UPDATE ON "memberships"
  FOR EACH ROW EXECUTE FUNCTION "memberships_guard"();

-- T7: الاسترداد لطلب مدفوع فقط، ومجموع غير المرفوض وغير الفاشل لا يتجاوز إجمالي الطلب.
CREATE FUNCTION "refunds_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  head record;
  committed bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.order_id, NEW.amount_minor) IS DISTINCT FROM (OLD.order_id, OLD.amount_minor) THEN
      RAISE EXCEPTION 'refund_terms_immutable';
    END IF;
    IF OLD.status IN ('rejected', 'completed', 'failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'refund_status_final';
    END IF;
  END IF;
  SELECT paid_at, total_minor INTO head FROM "orders" WHERE id = NEW.order_id FOR UPDATE;
  IF head.paid_at IS NULL THEN
    RAISE EXCEPTION 'refund_requires_paid_order';
  END IF;
  SELECT coalesce(sum(amount_minor), 0) INTO committed FROM "refunds"
   WHERE order_id = NEW.order_id AND status NOT IN ('rejected', 'failed') AND id IS DISTINCT FROM NEW.id;
  IF NEW.status NOT IN ('rejected', 'failed') AND committed + NEW.amount_minor > head.total_minor THEN
    RAISE EXCEPTION 'refund_exceeds_order_total';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "refunds_guard" BEFORE INSERT OR UPDATE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION "refunds_guard"();
