import { formatPlainDate } from "@masar/domain";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import type { OrdersFilter } from "@/server/admin/sales/orders-query";
import { ButtonLink, buttonClass } from "../ui/kit";
import { ToolbarField, ToolbarSearch, toolbarStyles } from "../ui/toolbar";

const REFERENCE_MAX_LENGTH = 24;

interface OrdersFiltersProps {
  readonly text: AdminDictionary["sales"]["orders"]["filters"];
  readonly filter: OrdersFilter;
  /** اليوم بتقويم النادي: لا يُختار يوم بعده. */
  readonly today: string;
}

/**
 * شريط أدوات الطلبات: نموذج GET عادي، فالمدى والتبويب في الرابط يُشاركان ويُحفظان ويعمل الرجوع وبلا
 * JavaScript. المرجع ليس بيانًا شخصيًا؛ البحث بالجوال في «العملاء» وهو POST.
 */
export function OrdersFilters({ text, filter, today }: OrdersFiltersProps) {
  const filtered = filter.customRange || filter.reference !== null;
  return (
    <form
      method="get"
      action={ADMIN_ROUTES.orders}
      className={toolbarStyles.form}
      aria-label={text.legend}
    >
      {filter.tab === "all" ? null : <input type="hidden" name="tab" value={filter.tab} />}
      <ToolbarSearch
        id="orders-reference"
        name="reference"
        label={text.reference}
        defaultValue={filter.reference?.raw ?? ""}
        placeholder={text.referencePlaceholder}
        dir="ltr"
        autoComplete="off"
        maxLength={REFERENCE_MAX_LENGTH}
        data-admin-search=""
      />
      <ToolbarField id="orders-from" label={text.from}>
        <input
          id="orders-from"
          name="from"
          type="date"
          className={toolbarStyles.control}
          defaultValue={filter.invalidRange ? "" : formatPlainDate(filter.from)}
          max={today}
        />
      </ToolbarField>
      <ToolbarField id="orders-to" label={text.to}>
        <input
          id="orders-to"
          name="to"
          type="date"
          className={toolbarStyles.control}
          defaultValue={filter.invalidRange ? "" : formatPlainDate(filter.to)}
          max={today}
        />
      </ToolbarField>
      <div className={cx(toolbarStyles.actions, toolbarStyles.end)}>
        {filtered ? (
          <ButtonLink href={ADMIN_ROUTES.orders} variant="ghost" size="small">
            {text.clear}
          </ButtonLink>
        ) : null}
        <button type="submit" className={buttonClass({ size: "small" })}>
          {text.apply}
        </button>
      </div>
    </form>
  );
}
