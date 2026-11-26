"use client";

import type { AdminDictionary } from "@/i18n/admin";
import { fill } from "@/i18n/fill";
import { PRODUCT_IDS_FIELD, selectedProductIds } from "@/server/admin/sales/promotion-form";
import { formStyles, type FieldForm } from "../ui/field-form";
import {
  CheckboxField,
  DateField,
  FieldGroup,
  FieldRow,
  SelectField,
  TextField,
} from "../ui/fields";
import { Card, Facts } from "../ui/kit";

export type PromotionFormLabels = AdminDictionary["sales"]["promotions"]["form"];

export interface PromotionProductChoice {
  readonly id: string;
  /** الاسم ونوعه: «3 أشهر (اشتراك)». */
  readonly label: string;
}

export interface SectionProps {
  readonly form: FieldForm;
  readonly labels: PromotionFormLabels;
  readonly products: readonly PromotionProductChoice[];
  readonly timezone: string;
  readonly types: Readonly<Record<string, string>>;
}

const NAME_MAX = 80;
const CODE_MAX = 32;

function options(map: Readonly<Record<string, string>>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

/** ما يربط حقلًا بحالة النموذج: اسمه ومعرّفه وما كُتب فيه وخطؤه. */
function bind(form: FieldForm, name: string) {
  return {
    id: `promotion-${name}`,
    name,
    defaultValue: form.value(name),
    error: form.errorOf(name),
  };
}

/** حقل رقمي أو رمزي قصير: لاتيني الاتجاه وبلا إكمال تلقائي. */
const LATIN = { dir: "ltr", autoComplete: "off" } as const;

/** حقول مجمَّدة أو ثابتة تعود مع النموذج كما هي، فيُفحص كل شيء بدالة المجال نفسها. */
export function Kept({
  form,
  names,
}: {
  readonly form: FieldForm;
  readonly names: readonly string[];
}) {
  return (
    <>
      {names.map((name) => (
        <input key={name} type="hidden" name={name} value={form.value(name)} />
      ))}
    </>
  );
}

function TypeAndCode({ form, labels, types }: SectionProps) {
  return (
    <FieldRow>
      <SelectField
        {...bind(form, "type")}
        label={labels.type}
        hint={labels.typeHint}
        options={options(types)}
      />
      <div data-when="coupon">
        <TextField
          {...bind(form, "code")}
          {...LATIN}
          label={labels.code}
          hint={labels.codeHint}
          maxLength={CODE_MAX}
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>
    </FieldRow>
  );
}

export function BasicsCard(props: SectionProps & { readonly creating: boolean }) {
  const { form, labels, creating } = props;
  return (
    <Card title={creating ? labels.basicsTitle : labels.nameTitle}>
      {creating ? <TypeAndCode {...props} /> : <Kept form={form} names={["type", "code"]} />}
      <FieldRow>
        <TextField
          {...bind(form, "nameAr")}
          label={labels.nameAr}
          hint={labels.nameHint}
          maxLength={NAME_MAX}
          autoComplete="off"
          required
        />
        <TextField
          {...bind(form, "nameEn")}
          {...LATIN}
          label={labels.nameEn}
          maxLength={NAME_MAX}
          lang="en"
          required
        />
      </FieldRow>
    </Card>
  );
}

export function DiscountCard({ form, labels }: SectionProps) {
  return (
    <Card title={labels.discountTitle}>
      <FieldRow>
        <SelectField
          {...bind(form, "discountKind")}
          label={labels.discountKind}
          options={options(labels.kinds)}
        />
        <div data-when="percentage">
          <TextField
            {...bind(form, "percent")}
            {...LATIN}
            label={labels.percent}
            hint={labels.percentHint}
            inputMode="decimal"
          />
        </div>
        <div data-when="fixed_amount">
          <TextField
            {...bind(form, "amount")}
            {...LATIN}
            label={labels.amount}
            hint={labels.amountHint}
            inputMode="decimal"
          />
        </div>
      </FieldRow>
    </Card>
  );
}

function ProductChoices({ form, labels, products }: SectionProps) {
  const selected = new Set(selectedProductIds(form.state.values));
  return (
    <div data-when="listed_products">
      <FieldGroup
        legend={labels.products}
        hint={products.length === 0 ? labels.noProducts : labels.productsHint}
        error={form.errorOf("scope")}
      >
        <div className={formStyles.checkList}>
          {products.map((product) => (
            <CheckboxField
              key={product.id}
              id={`promotion-product-${product.id}`}
              name={PRODUCT_IDS_FIELD}
              value={product.id}
              defaultChecked={selected.has(product.id)}
              label={product.label}
            />
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

export function ScopeCard(props: SectionProps & { readonly scopeEditable: boolean }) {
  const { form, labels, scopeEditable } = props;
  return (
    <Card title={labels.scopeTitle}>
      {scopeEditable ? (
        <SelectField
          id="promotion-scope"
          name="scope"
          label={labels.scope}
          defaultValue={form.value("scope")}
          options={options(labels.scopes)}
        />
      ) : (
        <Kept form={form} names={["scope"]} />
      )}
      {scopeEditable || form.value("scope") === "listed_products" ? (
        <ProductChoices {...props} />
      ) : null}
      <Facts items={[[labels.audience, labels.audienceAnyone]]} />
      <p className={formStyles.note}>{labels.audienceHint}</p>
    </Card>
  );
}

function Limits({ form, labels }: SectionProps) {
  return (
    <FieldRow>
      <TextField
        {...bind(form, "maxRedemptions")}
        {...LATIN}
        label={labels.maxRedemptions}
        hint={labels.maxRedemptionsHint}
        inputMode="numeric"
      />
      <TextField
        {...bind(form, "maxPerCustomer")}
        {...LATIN}
        label={labels.maxPerCustomer}
        hint={labels.maxPerCustomerHint}
        inputMode="numeric"
      />
    </FieldRow>
  );
}

export function WindowCard(props: SectionProps & { readonly startEditable: boolean }) {
  const { form, labels, timezone, startEditable } = props;
  const zone = fill(labels.windowHint, { timezone });
  return (
    <Card title={labels.windowTitle}>
      <FieldRow>
        {startEditable ? (
          <DateField
            {...bind(form, "startsAt")}
            withTime
            label={labels.startsAt}
            hint={zone}
            required
          />
        ) : (
          <Kept form={form} names={["startsAt"]} />
        )}
        <DateField
          {...bind(form, "endsAt")}
          withTime
          label={labels.endsAt}
          hint={`${zone} ${labels.endsHint}`}
        />
        {startEditable ? null : <span aria-hidden="true" />}
      </FieldRow>
      <Limits {...props} />
      <CheckboxField
        id="promotion-stackable"
        name="stackable"
        label={labels.stackable}
        hint={labels.stackableHint}
        defaultChecked={form.value("stackable") === "on"}
      />
    </Card>
  );
}
