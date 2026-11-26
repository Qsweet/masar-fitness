import { formatPlainDate } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import type { OrdersFilter } from "@/server/admin/sales/orders-query";
import { DateField, TextField } from "../ui/fields";
import { ButtonLink, buttonClass } from "../ui/kit";
import styles from "./sales.module.css";

const REFERENCE_MAX_LENGTH = 24;

interface OrdersFiltersProps {
  readonly text: AdminDictionary["sales"]["orders"]["filters"];
  readonly filter: OrdersFilter;
  /** اليوم بتقويم النادي: لا يُختار يوم بعده. */
  readonly today: string;
}

/**
 * تصفية القائمة: نموذج GET عادي، فالمدى والتبويب في الرابط يُشاركان ويُحفظان ويعمل الرجوع وبلا
 * JavaScript. المرجع ليس بيانًا شخصيًا؛ البحث بالجوال في «العملاء» وهو POST.
 */
export function OrdersFilters({ text, filter, today }: OrdersFiltersProps) {
  const filtered = filter.customRange || filter.reference !== null;
  return (
    <form
      method="get"
      action={ADMIN_ROUTES.orders}
      className={styles.filters}
      aria-label={text.legend}
    >
      {filter.tab === "all" ? null : <input type="hidden" name="tab" value={filter.tab} />}
      <TextField
        id="orders-reference"
        name="reference"
        label={text.reference}
        defaultValue={filter.reference?.raw ?? ""}
        placeholder="MSR-0001234"
        dir="ltr"
        autoComplete="off"
        maxLength={REFERENCE_MAX_LENGTH}
      />
      <DateField
        id="orders-from"
        name="from"
        label={text.from}
        defaultValue={filter.invalidRange ? "" : formatPlainDate(filter.from)}
        max={today}
      />
      <DateField
        id="orders-to"
        name="to"
        label={text.to}
        defaultValue={filter.invalidRange ? "" : formatPlainDate(filter.to)}
        max={today}
      />
      <div className={styles.filterActions}>
        <button type="submit" className={buttonClass()}>
          {text.apply}
        </button>
        {filtered ? (
          <ButtonLink href={ADMIN_ROUTES.orders} variant="ghost">
            {text.clear}
          </ButtonLink>
        ) : null}
      </div>
    </form>
  );
}
