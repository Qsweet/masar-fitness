-- CreateTable
CREATE TABLE "clubs" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs"("slug");
