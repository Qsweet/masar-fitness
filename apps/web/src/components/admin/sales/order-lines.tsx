import type { OrderItemView, OrderView } from "@masar/db";
import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { formatMonths } from "@/i18n/format";
import { Cell, DataTable } from "../ui/data-table";
import { Card, Ltr } from "../ui/kit";
import { Amount } from "./order-parts";
import styles from "./sales.module.css";

type Sales = AdminDictionary["sales"];

interface LinesProps {
  readonly order: OrderView;
  readonly sales: Sales;
}

/** مدة السطر المختومة: الأشهر المدفوعة والمجانية وقاعدة البدء؛ ما ليس اشتراكًا بلا مدة. */
function Terms({ item, sales }: { readonly item: OrderItemView; readonly sales: Sales }) {
  const text = sales.orders.detail;
  if (item.paidMonths === null) {
    return <span className={styles.sub}>{text.noTerms}</span>;
  }
  return (
    <>
      {formatMonths(item.paidMonths, "ar")}
      {item.bonusMonths === 0 ? null : (
        <> {fill(text.bonus, { bonus: formatMonths(item.bonusMonths, "ar") })}</>
      )}
      {item.membershipStartRule === null ? null : (
        <span className={styles.sub}>{sales.statuses.startRule[item.membershipStartRule]}</span>
      )}
    </>
  );
}

/** السطور كما خُتمت: الاسم والمدة والسعر والخصم والإجمالي والضريبة المستخرجة. */
export function OrderItems({ order, sales }: LinesProps) {
  const text = sales.orders.detail;
  const columns = text.itemColumns;
  return (
    <Card title={text.items} flush>
      <DataTable caption={text.items} columns={Object.values(columns)} testId="order-items">
        {order.items.map((item) => (
          <tr key={item.position}>
            <Cell label={columns.item} strong>
              {item.name.ar}
              <span className={styles.sub}>{sales.statuses.itemKind[item.kind]}</span>
            </Cell>
            <Cell label={columns.terms}>
              <Terms item={item} sales={sales} />
            </Cell>
            <Cell label={columns.price} nowrap>
              <Amount value={item.listPrice} />
            </Cell>
            <Cell label={columns.discount} nowrap muted={item.discount.amountMinor === 0}>
              <Amount value={item.discount} />
            </Cell>
            <Cell label={columns.total} nowrap strong>
              <Amount value={item.total} />
            </Cell>
            <Cell label={columns.vat} nowrap muted>
              <Amount value={item.vat} />
            </Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

/** الخصومات المختومة بترتيب تطبيقها؛ لا تُعرض البطاقة لطلب بلا خصم. */
export function OrderDiscounts({ order, sales }: LinesProps) {
  if (order.discounts.length === 0) {
    return null;
  }
  const text = sales.orders.detail;
  const columns = text.discountColumns;
  return (
    <Card title={text.discounts} flush>
      <DataTable caption={text.discounts} columns={Object.values(columns)}>
        {order.discounts.map((discount) => (
          <tr key={discount.sequence}>
            <Cell label={columns.name} strong>
              {discount.name.ar}
            </Cell>
            <Cell label={columns.source}>{sales.statuses.discountSource[discount.source]}</Cell>
            <Cell label={columns.code} muted={discount.code === null}>
              {discount.code === null ? text.noCode : <Ltr>{discount.code}</Ltr>}
            </Cell>
            <Cell label={columns.amount} nowrap>
              − <Amount value={discount.amount} />
            </Cell>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
