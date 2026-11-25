/*
 * ملفات الشعار SVG تُستورد صورًا ثابتة (رابط وأبعاد)، فلا مكوّن SVGR في هذا المشروع. Next يعرّف كل
 * ‎*.svg‎ بنوع any احتياطًا لـSVGR؛ هذا التعريف الأخص (البادئة الأطول تغلب) يعطي ملفات الشعار نوعها الحقيقي.
 */
declare module "@/assets/brand/*.svg" {
  import type { StaticImageData } from "next/image";

  const content: StaticImageData;
  export default content;
}
