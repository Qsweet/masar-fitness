-- CreateEnum
CREATE TYPE "product_kind" AS ENUM ('membership', 'digital_program', 'assessed_service');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('draft', 'active', 'archived');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "club_id" UUID NOT NULL,
    "kind" "product_kind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "summary_ar" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "product_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_versions" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "duration_months" INTEGER,
    "bonus_months" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_benefits" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "label_ar" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_club_id_kind_status_sort_order_idx" ON "products"("club_id", "kind", "status", "sort_order");

-- CreateIndex
CREATE INDEX "product_versions_product_id_valid_from_idx" ON "product_versions"("product_id", "valid_from");

-- CreateIndex
CREATE INDEX "product_benefits_version_id_sort_order_idx" ON "product_benefits"("version_id", "sort_order");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_benefits" ADD CONSTRAINT "product_benefits_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "product_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- قيود سلامة لا يعبّر عنها مخطط Prisma: القاعدة ترفض السعر السالب والمدة غير الموجبة وفترة السريان المقلوبة
ALTER TABLE "product_versions"
  ADD CONSTRAINT "product_versions_price_non_negative" CHECK ("price_minor" >= 0),
  ADD CONSTRAINT "product_versions_duration_positive" CHECK ("duration_months" IS NULL OR "duration_months" > 0),
  ADD CONSTRAINT "product_versions_bonus_non_negative" CHECK ("bonus_months" >= 0),
  ADD CONSTRAINT "product_versions_validity_ordered" CHECK ("valid_until" IS NULL OR "valid_until" > "valid_from");
