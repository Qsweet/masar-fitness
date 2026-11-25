-- المرحلة 3: نوع منتج جديد «إضافة» تُباع مع باقة مرتبطة بها في product_addons.
-- منفرد في ترحيله لأن قيمة enum الجديدة لا تُستعمل في المعاملة التي أُضيفت فيها،
-- وترحيل 20261125090100_commerce يستعملها افتراضيًا لعمود product_addons.addon_kind.
ALTER TYPE "product_kind" ADD VALUE 'addon';
