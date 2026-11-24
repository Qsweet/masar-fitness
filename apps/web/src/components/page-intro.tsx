import type { ReactNode } from "react";

interface PageIntroProps {
  readonly title: string;
  readonly lead: string;
  /** عنصر فوق العنوان، مثل رابط الرجوع. */
  readonly before?: ReactNode;
}

/**
 * رأس الصفحة على شريط الماء العميق، امتدادًا للترويسة: عنوان بوزن خفيف وسطر واحد تحته.
 * قصير عمدًا: ما يليه مباشرة هو اختيار الباقة والسعر.
 */
export function PageIntro({ title, lead, before }: PageIntroProps) {
  return (
    <section className="surface-deep pt-3 pb-6 md:pt-10 md:pb-14">
      <div className="page-container">
        {before}
        <h1 className="max-w-[18ch] text-display font-display md:max-w-[22ch]">{title}</h1>
        <p className="text-muted mt-2 max-w-prose md:mt-3 md:text-lead">{lead}</p>
      </div>
    </section>
  );
}
