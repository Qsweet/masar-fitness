-- سلامة الكتالوج (من المراجعة المستقلة للمرحلة 2): القاعدة نفسها تمنع الحالات التي كان الكود يفترض غيابها.

-- يلزم لقيد منع التداخل على عمود uuid مع مدى زمني
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "product_versions"
  -- العملة الوحيدة المدعومة؛ يوسَّع القيد مع أي عملة تُضاف إلى CURRENCIES في packages/domain
  ADD CONSTRAINT "product_versions_currency_supported" CHECK ("currency" = 'SAR'),
  -- لا نسختان ساريتان للمنتج نفسه في اللحظة نفسها: السعر المعروض واحد دائمًا
  ADD CONSTRAINT "product_versions_no_overlap"
    EXCLUDE USING gist ("product_id" WITH =, tstzrange("valid_from", "valid_until", '[)') WITH &&);

-- المعرّف النصي يدخل الروابط: حروف لاتينية صغيرة وأرقام وشرطات فقط
ALTER TABLE "products"
  ADD CONSTRAINT "products_slug_shape" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 80);
