import { notFound } from "next/navigation";

/** أي مسار غير معرَّف داخل اللغة يعرض صفحة «غير موجودة» بلغة الزائر واتجاهها. */
export default function UnknownPath(): never {
  notFound();
}
