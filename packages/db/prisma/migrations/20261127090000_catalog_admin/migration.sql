-- المرحلة A2 (WP6): إدارة الكتالوج من اللوحة (docs/ADMIN_A2_SALES.md §3).

-- اسم الفئة التسويقي للاشتراك («رحلة الأبطال») ينتقل من قاموس الموقع إلى القاعدة: مصدر واحد يعدّله
-- الموظف من اللوحة. باللغتين معًا أو لا شيء، ومن 1 إلى 60 محرفًا بعد التشذيب.
ALTER TABLE "products"
  ADD COLUMN "tier_ar" TEXT,
  ADD COLUMN "tier_en" TEXT;

ALTER TABLE "products"
  ADD CONSTRAINT "products_tier_both_or_none" CHECK (("tier_ar" IS NULL) = ("tier_en" IS NULL)),
  ADD CONSTRAINT "products_tier_ar_length" CHECK ("tier_ar" IS NULL OR char_length(btrim("tier_ar")) BETWEEN 1 AND 60),
  ADD CONSTRAINT "products_tier_en_length" CHECK ("tier_en" IS NULL OR char_length(btrim("tier_en")) BETWEEN 1 AND 60);

-- القيم الثلاث التي كانت في القاموس (`tiers` في landing-ar.ts و landing-en.ts) تُنقل كما هي، فلا يتغير
-- ما يعرضه الموقع العام بعد الترحيل. قاعدة بلا هذه الباقات لا يُكتب فيها شيء.
UPDATE "products" SET "tier_ar" = 'انطلاقة الأبطال', "tier_en" = 'Champions'' Start'
  WHERE "slug" = 'three-months' AND "kind" = 'membership';
UPDATE "products" SET "tier_ar" = 'مسار التغيير', "tier_en" = 'The Change Path'
  WHERE "slug" = 'six-months' AND "kind" = 'membership';
UPDATE "products" SET "tier_ar" = 'رحلة الأبطال', "tier_en" = 'Champions'' Journey'
  WHERE "slug" = 'one-year' AND "kind" = 'membership';

-- P1: هوية المنتج ثابتة بعد الإنشاء. المعرّف النصي في الرابط العام وفي سلة العميل، والنوع يحدد مسار
-- البيع ومفاتيح سطور الطلبات (FK3)، والنادي والإنشاء لا يتغيران.
CREATE FUNCTION "products_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.club_id, NEW.kind, NEW.slug, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.club_id, OLD.kind, OLD.slug, OLD.created_at) THEN
    RAISE EXCEPTION 'product_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_guard" BEFORE UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION "products_guard"();
