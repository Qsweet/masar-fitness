-- المرحلة A2 (WP4، تصحيح المراجعة): فرادة المرجع الخارجي للدفعة اليدوية بمفتاح موحَّد، ولكل نادٍ
-- مهما كانت الطريقة (docs/DECISIONS.md، القرار 67). الفهرس السابق كان على النص كما كُتب، فحوالة
-- واحدة سوّت أكثر من طلب بتغيير شكل كتابتها («trf-99»، «TRF 99»، أرقام عربية).

-- المفتاح يحسبه الكود (manualReferenceKey في المجال): أرقام لاتينية، NFKC، حروف كبيرة، وبلا أي
-- محرف ليس حرفًا أو رقمًا. ما كتبه الموظف يبقى في external_reference للعرض.
ALTER TABLE "manual_payments" ADD COLUMN "reference_key" TEXT;

-- ملء الصفوف القائمة بأقرب ما تحسبه القاعدة للمفتاح نفسه. الصف الذي يصطدم مفتاحه بصف أقدم منه في
-- النادي نفسه (دفعة سُجّلت قبل هذا التصحيح بمرجع مكرر الشكل)، أو يقصر مفتاحه عن ثلاثة، يأخذ مفتاحًا
-- فريدًا بمعرّفه («DUP» ثم المعرّف بلا شرطات): الدفعات المسجّلة لا تُحذف ولا تُعدَّل تسويتها، والترحيل
-- لا يفشل، والمرجع نفسه يبقى محجوزًا للصف الأقدم فلا يُستعمل مرة أخرى. مراجعة هذه الصفوف يدوية:
-- SELECT * FROM manual_payments WHERE reference_key LIKE 'DUP%';
ALTER TABLE "manual_payments" DISABLE TRIGGER "manual_payments_forbid_mutation";

UPDATE "manual_payments" SET "reference_key" = upper(regexp_replace(
  normalize(translate("external_reference", '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), NFKC),
  '[^[:alnum:]]', '', 'g'));

UPDATE "manual_payments" m SET "reference_key" = 'DUP' || upper(replace(m."id"::text, '-', ''))
WHERE char_length(m."reference_key") < 3
   OR EXISTS (SELECT 1 FROM "manual_payments" o
               WHERE o."club_id" = m."club_id" AND o."reference_key" = m."reference_key"
                 AND (o."created_at", o."id") < (m."created_at", m."id"));

ALTER TABLE "manual_payments" ENABLE TRIGGER "manual_payments_forbid_mutation";

ALTER TABLE "manual_payments" ALTER COLUMN "reference_key" SET NOT NULL;

-- DropIndex: الفرادة لم تعد على النص كما كُتب ولا لكل طريقة
DROP INDEX "manual_payments_club_id_method_external_reference_key";

-- CreateIndex: المرجع لا يسوّي طلبين في النادي، بأي طريقة وبأي كتابة
CREATE UNIQUE INDEX "manual_payments_club_id_reference_key_key" ON "manual_payments"("club_id", "reference_key");

ALTER TABLE "manual_payments"
  -- حروف وأرقام فقط، بلا حروف صغيرة ولا فراغ، وثلاثة على الأقل
  ADD CONSTRAINT "manual_payments_reference_key_shape"
    CHECK ("reference_key" = upper("reference_key") AND "reference_key" !~ '[[:space:][:punct:]]'
      AND char_length("reference_key") >= 3);
