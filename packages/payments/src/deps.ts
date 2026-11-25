import type { Db } from "@masar/db";
import type { PaymentLogger } from "./log";
import type { PaymentProvider } from "./port";

/** ما يحتاجه تنسيق الدفع. كله محقون: القاعدة والمزوّد والسجل والساعة، فيُختبر بلا شبكة. */
export interface PaymentDeps {
  readonly db: Db;
  readonly provider: PaymentProvider;
  readonly logger: PaymentLogger;
  readonly clock: () => Date;
  /** أقل وقت معقول لإكمال الدفع بالدقائق، من الإعداد (`PAYMENTS_MIN_PAYMENT_MINUTES`). */
  readonly minPaymentMinutes: number;
}
