import { AUDIT_ACTOR_KINDS, AUDIT_ENTITY_TYPES } from "@masar/db";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { cx } from "@/lib/cx";
import { ButtonLink, buttonClass } from "./ui/kit";
import { ToolbarField, toolbarStyles } from "./ui/toolbar";

const ALL = "";

interface AuditFiltersProps {
  readonly text: AdminDictionary["audit"];
  readonly entityType: string | undefined;
  readonly actorKind: string | undefined;
}

interface FilterSelectProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

function FilterSelect({ id, name, label, value, options }: FilterSelectProps) {
  return (
    <ToolbarField id={id} label={label}>
      <select id={id} name={name} defaultValue={value} className={toolbarStyles.control}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </ToolbarField>
  );
}

/** شريط أدوات السجل. نموذج GET عادي: التصفية في الرابط، فتُشارك وتُحفظ ويعمل الرجوع، وبلا JavaScript. */
export function AuditFilters({ text, entityType, actorKind }: AuditFiltersProps) {
  const { filters } = text;
  const all = { value: ALL, label: filters.all };
  return (
    <form
      method="get"
      action={ADMIN_ROUTES.audit}
      className={toolbarStyles.form}
      aria-label={filters.legend}
    >
      <FilterSelect
        id="audit-entity"
        name="entity"
        label={filters.entity}
        value={entityType ?? ALL}
        options={[
          all,
          ...AUDIT_ENTITY_TYPES.map((value) => ({ value, label: text.entities[value] })),
        ]}
      />
      <FilterSelect
        id="audit-actor"
        name="actor"
        label={filters.actor}
        value={actorKind ?? ALL}
        options={[all, ...AUDIT_ACTOR_KINDS.map((value) => ({ value, label: text.actors[value] }))]}
      />
      <div className={cx(toolbarStyles.actions, toolbarStyles.end)}>
        {entityType === undefined && actorKind === undefined ? null : (
          <ButtonLink href={ADMIN_ROUTES.audit} variant="ghost" size="small">
            {filters.clear}
          </ButtonLink>
        )}
        <button type="submit" className={buttonClass({ size: "small" })}>
          {filters.apply}
        </button>
      </div>
    </form>
  );
}
