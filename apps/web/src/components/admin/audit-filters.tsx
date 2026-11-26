import { AUDIT_ACTOR_KINDS, AUDIT_ENTITY_TYPES } from "@masar/db";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { SelectField } from "./ui/fields";
import { ButtonLink, buttonClass, uiStyles } from "./ui/kit";

const ALL = "";

interface AuditFiltersProps {
  readonly text: AdminDictionary["audit"];
  readonly entityType: string | undefined;
  readonly actorKind: string | undefined;
}

/** شريط تصفية مضغوط. نموذج GET عادي: التصفية في الرابط، فتُشارك وتُحفظ ويعمل الرجوع، وبلا JavaScript. */
export function AuditFilters({ text, entityType, actorKind }: AuditFiltersProps) {
  const { filters } = text;
  const all = { value: ALL, label: filters.all };
  return (
    <form
      method="get"
      action={ADMIN_ROUTES.audit}
      className={uiStyles.inlineForm}
      aria-label={filters.legend}
    >
      <SelectField
        id="audit-entity"
        name="entity"
        label={filters.entity}
        defaultValue={entityType ?? ALL}
        options={[
          all,
          ...AUDIT_ENTITY_TYPES.map((value) => ({ value, label: text.entities[value] })),
        ]}
      />
      <SelectField
        id="audit-actor"
        name="actor"
        label={filters.actor}
        defaultValue={actorKind ?? ALL}
        options={[all, ...AUDIT_ACTOR_KINDS.map((value) => ({ value, label: text.actors[value] }))]}
      />
      <button type="submit" className={buttonClass()}>
        {filters.apply}
      </button>
      {entityType === undefined && actorKind === undefined ? null : (
        <ButtonLink href={ADMIN_ROUTES.audit} variant="ghost">
          {filters.clear}
        </ButtonLink>
      )}
    </form>
  );
}
