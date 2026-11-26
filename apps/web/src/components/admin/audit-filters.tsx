import { AUDIT_ACTOR_KINDS, AUDIT_ENTITY_TYPES } from "@masar/db";
import Link from "next/link";
import { ADMIN_ROUTES } from "@/config/admin";
import type { AdminDictionary } from "@/i18n/admin";
import { adminButton, SelectField } from "./fields";
import styles from "./page.module.css";

const ALL = "";

interface AuditFiltersProps {
  readonly text: AdminDictionary["audit"];
  readonly entityType: string | undefined;
  readonly actorKind: string | undefined;
}

/** نموذج GET عادي: التصفية في الرابط، فتُشارك وتُحفظ ويعمل الرجوع، وبلا JavaScript. */
export function AuditFilters({ text, entityType, actorKind }: AuditFiltersProps) {
  const { filters } = text;
  const all = { value: ALL, label: filters.all };
  return (
    <form method="get" action={ADMIN_ROUTES.audit} className={styles.filters}>
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
      <button type="submit" className={adminButton("primary")}>
        {filters.apply}
      </button>
      {entityType === undefined && actorKind === undefined ? null : (
        <Link href={ADMIN_ROUTES.audit} prefetch={false} className={adminButton("ghost")}>
          {filters.clear}
        </Link>
      )}
    </form>
  );
}
