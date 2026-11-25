import { MAX_COUPON_INPUT_LENGTH } from "@/config/checkout";
import { Price } from "@/components/ui/price";
import { buttonClass } from "@/components/ui/button-link";
import type { Dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";
import { FIELD_IDS } from "./field-ids";
import type { AddonChoice, CouponMessage } from "./quote-view";
import styles from "./fields.module.css";

const COUPON_HINT_ID = "coupon-hint";
const COUPON_MESSAGE_ID = "coupon-message";

interface OptionsFormProps {
  /** صفحة الشراء نفسها: النموذج GET يعيد عرضها بالخيارات الجديدة بلا JavaScript. */
  readonly action: string;
  readonly addons: readonly AddonChoice[];
  readonly coupon: string;
  readonly couponMessage: CouponMessage | undefined;
  readonly labels: Dictionary["checkout"]["options"];
}

function AddonChoices({ addons, legend }: { addons: readonly AddonChoice[]; legend: string }) {
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.legend}>{legend}</legend>
      {addons.map((addon) => (
        <label key={addon.slug} className={styles.choice}>
          <input type="checkbox" name="addon" value={addon.slug} defaultChecked={addon.checked} />
          <span className={styles.choiceName}>{addon.name}</span>
          <Price parts={addon.price} className={styles.choicePrice} />
        </label>
      ))}
    </fieldset>
  );
}

/**
 * الإضافات والكوبون: نموذج GET يعيد حساب الملخص على الخادم (لا سعر يُحسب في المتصفح)،
 * فيعمل بلا JavaScript. رسالة الكوبون مربوطة بالحقل بـaria-describedby.
 */
export function OptionsForm({ action, addons, coupon, couponMessage, labels }: OptionsFormProps) {
  const describedBy = cx(COUPON_HINT_ID, couponMessage !== undefined && COUPON_MESSAGE_ID);
  return (
    <form method="get" action={action} className={styles.panel}>
      <h2 className={styles.title}>{labels.title}</h2>
      {addons.length > 0 ? <AddonChoices addons={addons} legend={labels.addonsLegend} /> : null}
      <div className={styles.field}>
        <label htmlFor={FIELD_IDS.coupon} className={styles.label}>
          {labels.coupon}
        </label>
        <p id={COUPON_HINT_ID} className={styles.hint}>
          {labels.couponHint}
        </p>
        <input
          id={FIELD_IDS.coupon}
          name="coupon"
          defaultValue={coupon}
          maxLength={MAX_COUPON_INPUT_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          dir="ltr"
          aria-describedby={describedBy}
          aria-invalid={couponMessage?.blocking === true ? true : undefined}
          className={styles.input}
        />
        {couponMessage === undefined ? null : (
          <p id={COUPON_MESSAGE_ID} className={couponMessage.blocking ? styles.error : styles.info}>
            {couponMessage.text}
          </p>
        )}
      </div>
      <button type="submit" className={buttonClass("outline", true)}>
        {labels.apply}
      </button>
    </form>
  );
}
