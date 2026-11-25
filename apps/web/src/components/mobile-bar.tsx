import { INTRO_ID } from "@/components/page-intro";
import type { PurchaseLink } from "@/components/plans/plan-view";
import { PurchaseButton } from "@/components/plans/purchase-button";
import { StickyReveal } from "@/components/ui/sticky-reveal";
import styles from "./mobile-bar.module.css";

/** الفعل الرئيسي في الشريط: إضافة الاشتراك إلى السلة أو واتساب الاشتراك. */
export interface MobileBarAction {
  readonly purchase: PurchaseLink;
  readonly label: string;
}

interface MobileBarProps {
  readonly label: string;
  readonly action: MobileBarAction;
}

/**
 * شريط فعل الصفحة على الهاتف فوق شريط التبويب (صفحة الاشتراك الواحد: زر الشراء) في منطقة الإبهام.
 * يظهر بعد أن يتجاوز الزائر رأس الصفحة (#top)، فلا يكرر زر بطاقة السعر ولا يحجب ما تحتها.
 * بلا JavaScript يبقى مخفيًا كشريط الشراء. واتساب في شريط التبويب تحته.
 */
export function MobileBar({ label, action }: MobileBarProps) {
  return (
    <StickyReveal afterId={INTRO_ID} label={label} className={styles.bar}>
      <PurchaseButton purchase={action.purchase} className={styles.action}>
        {action.label}
      </PurchaseButton>
    </StickyReveal>
  );
}
