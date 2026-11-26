"use client";

import { ADMIN_ROUTES } from "@/config/admin";
import { cx } from "@/lib/cx";
import type { AdminDictionary } from "@/i18n/admin";
import {
  createPlanAction,
  savePlanIdentityAction,
  savePlanTermsAction,
} from "@/server/admin/actions/sales-plans";
import type { FormValues } from "@/server/admin/field-form";
import {
  formStyles,
  FormButton,
  FormFooter,
  FormTop,
  ReviewStep,
  useFieldForm,
} from "../ui/field-form";
import { FieldRow, TextField } from "../ui/fields";
import { ButtonLink, Card } from "../ui/kit";
import { BenefitRows, IdentityFields, TermsFields, type PlanFormLabels } from "./plan-fields";

type PlansText = AdminDictionary["sales"]["plans"];
type Errors = Readonly<Record<string, string>>;

interface CreateProps {
  /** يولَّد عند رسم الصفحة: الإرسال الثاني بالمعرّف نفسه لا ينشئ منتجًا ثانيًا. */
  readonly productId: string;
  readonly kind: "membership" | "addon";
  readonly values: FormValues;
  readonly labels: PlanFormLabels;
  readonly text: PlansText["new"];
  readonly errors: Errors;
}

const SLUG_MAX = 80;

/** نموذج منتج جديد في ثلاث بطاقات: الهوية، السعر والمدة، المزايا. */
export function PlanCreateForm({ productId, kind, values, labels, text, errors }: CreateProps) {
  const form = useFieldForm(createPlanAction, values, errors);
  return (
    <form action={form.formAction} className={formStyles.formStack} noValidate>
      <FormTop form={form} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="kind" value={kind} />
      <div key={form.state.stamp} className={formStyles.formStack}>
        <Card title={labels.identityTitle} description={labels.identityLead}>
          <FieldRow>
            <TextField
              id="plan-slug"
              name="slug"
              label={labels.slug}
              hint={labels.slugHint}
              error={form.errorOf("slug")}
              defaultValue={form.value("slug")}
              maxLength={SLUG_MAX}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <span aria-hidden="true" />
          </FieldRow>
          <IdentityFields form={form} labels={labels} kind={kind} />
        </Card>
        <Card title={labels.termsTitle}>
          <TermsFields form={form} labels={labels} kind={kind} />
        </Card>
        <Card>
          <BenefitRows form={form} labels={labels} />
        </Card>
      </div>
      <FormFooter>
        <FormButton form={form} intent="save">
          {text.submit}
        </FormButton>
        <ButtonLink href={ADMIN_ROUTES.plans} variant="ghost" size="large">
          {text.cancel}
        </ButtonLink>
      </FormFooter>
    </form>
  );
}

interface EditProps {
  readonly productId: string;
  readonly kind: "membership" | "addon";
  /** رمز القفل المتفائل كما قُرئ عند رسم الصفحة. */
  readonly lockToken: string;
  readonly values: FormValues;
  readonly labels: PlanFormLabels;
  readonly errors: Errors;
}

export function PlanIdentityForm({
  productId,
  kind,
  lockToken,
  values,
  labels,
  errors,
}: EditProps) {
  const form = useFieldForm(savePlanIdentityAction, values, errors);
  return (
    <form action={form.formAction} className={cx(formStyles.form, formStyles.bounded)} noValidate>
      <FormTop form={form} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="lockToken" value={lockToken} />
      <div key={form.state.stamp} className={formStyles.form}>
        <IdentityFields form={form} labels={labels} kind={kind} />
      </div>
      <FormFooter>
        <FormButton form={form} intent="save">
          {labels.saveIdentity}
        </FormButton>
      </FormFooter>
    </form>
  );
}

type TermsProps = EditProps & { readonly confirm: PlansText["termsConfirm"] };

/**
 * نموذج السعر والمدة والمزايا. لمنتج منشور يعيد الخادم عرض القديم والجديد وعواقب التغيير قبل التنفيذ،
 * والمسودة تُحفظ مباشرة.
 */
export function PlanTermsForm(props: TermsProps) {
  const { productId, kind, lockToken, values, labels, errors, confirm } = props;
  const form = useFieldForm(savePlanTermsAction, values, errors);
  const reviewing = form.state.step === "confirm";
  return (
    <form
      action={form.formAction}
      className={cx(formStyles.form, formStyles.bounded)}
      noValidate
      data-step={form.state.step}
    >
      <FormTop form={form} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="lockToken" value={lockToken} />
      {reviewing ? (
        <ReviewStep form={form} labels={confirm} />
      ) : (
        <>
          <div key={form.state.stamp} className={formStyles.form}>
            <TermsFields form={form} labels={labels} kind={kind} />
            <BenefitRows form={form} labels={labels} />
          </div>
          <FormFooter>
            <FormButton form={form} intent="save">
              {labels.saveTerms}
            </FormButton>
          </FormFooter>
        </>
      )}
    </form>
  );
}
