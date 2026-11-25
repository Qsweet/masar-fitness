import { ButtonLink, buttonClass } from "@/components/ui/button-link";
import { payOrder } from "@/server/payments/actions";
import type { PaymentPanelView } from "./payment-view";
import reviewStyles from "./order-review.module.css";
import styles from "./payment-panel.module.css";

interface PaymentPanelProps {
  readonly view: PaymentPanelView;
}

/**
 * قسم الدفع في صفحة الطلب (يُعرض فقط حين يُضبط مزوّد والشراء مفتوح). الزر نموذج POST عادي يعمل بلا
 * JavaScript: الخادم ينشئ المحاولة ويوجّه إلى صفحة المزوّد المستضافة. لا حقل بطاقة في صفحاتنا.
 * «حدّث حالة الدفع» رابط عادي (بلا جلب مسبق) إلى صفحة العودة التي تتحقق من المزوّد.
 */
export function PaymentPanel({ view }: PaymentPanelProps) {
  return (
    <section aria-labelledby="payment-title" className={reviewStyles.panel}>
      <h2 id="payment-title" className={reviewStyles.panelTitle}>
        {view.title}
      </h2>
      {view.demoNotice === null ? null : <p className={styles.demo}>{view.demoNotice}</p>}
      {view.notice === null ? null : (
        <p role="status" className={styles.notice}>
          {view.notice}
        </p>
      )}
      <p>{view.lead}</p>
      <div className={styles.actions}>
        {view.payLabel === null ? null : (
          <form action={payOrder}>
            <input type="hidden" name="token" value={view.token} />
            <input type="hidden" name="locale" value={view.locale} />
            <button type="submit" className={buttonClass("ink", true)} data-testid="pay-now">
              {view.payLabel}
            </button>
          </form>
        )}
        {view.refresh === null ? null : (
          <ButtonLink href={view.refresh.href} variant="line" external block>
            {view.refresh.label}
          </ButtonLink>
        )}
        {view.whatsapp === null ? null : (
          <ButtonLink href={view.whatsapp.href} external block>
            {view.whatsapp.label}
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
