/* شعارات طرق الدفع SVG صور ثابتة كملفات الشعار (src/assets/brand/svg.d.ts)، لا مكوّنات SVGR. */
declare module "@/assets/payments/*.svg" {
  import type { StaticImageData } from "next/image";

  const content: StaticImageData;
  export default content;
}
