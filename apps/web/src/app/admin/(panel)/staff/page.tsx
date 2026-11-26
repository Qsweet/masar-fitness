import { listStaff, type StaffAccount } from "@masar/db";
import type { Metadata } from "next";
import { Cell, DataTable } from "@/components/admin/ui/data-table";
import { Badge, ButtonLink, Card, Ltr, PageHeader } from "@/components/admin/ui/kit";
import { ADMIN_ROUTES, FALLBACK_TIMEZONE, staffMemberPath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { formatNumber } from "@/i18n/format";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().staff.title };
}

interface RowProps {
  readonly member: StaffAccount;
  readonly isSelf: boolean;
  readonly timezone: string;
  readonly dictionary: AdminDictionary;
}

function StaffRow({ member, isSelf, timezone, dictionary }: RowProps) {
  const { staff, roles, statuses, common } = dictionary;
  const { columns } = staff;
  return (
    <tr>
      <Cell label={columns.name} strong>
        {member.displayName} {isSelf ? <Badge tone="accent">{staff.you}</Badge> : null}
      </Cell>
      <Cell label={columns.email} muted>
        <Ltr>{member.email}</Ltr>
      </Cell>
      <Cell label={columns.role}>{roles[member.role]}</Cell>
      <Cell label={columns.status}>
        <Badge tone={member.status === "active" ? "success" : "neutral"}>
          {statuses[member.status]}
        </Badge>
      </Cell>
      <Cell label={columns.mfa}>
        <Badge tone={member.totpEnabled ? "success" : "warning"}>
          {member.totpEnabled ? staff.mfaOn : staff.mfaOff}
        </Badge>
      </Cell>
      <Cell label={columns.lastLogin} muted nowrap>
        {member.lastLoginAt === null ? common.never : formatDateTime(member.lastLoginAt, timezone)}
      </Cell>
      <Cell label="" align="end">
        <ButtonLink
          href={staffMemberPath(member.id)}
          size="small"
          label={fill(staff.manageLabel, { name: member.displayName })}
        >
          {staff.manage}
        </ButtonLink>
      </Cell>
    </tr>
  );
}

/** قائمة حسابات اللوحة. للمالك وحده (`staff.manage`). */
export default async function StaffPage() {
  const context = await requireStaff("staff.manage");
  const dictionary = getAdminDictionary();
  const { staff } = dictionary;
  const [members, club] = await Promise.all([
    listStaff(getDb(), context.staff.clubId),
    staffClub(context.staff.clubId),
  ]);
  return (
    <>
      <PageHeader title={staff.title} description={staff.lead}>
        <ButtonLink href={ADMIN_ROUTES.staffNew} variant="primary">
          {staff.add}
        </ButtonLink>
      </PageHeader>
      <Card title={fill(staff.count, { count: formatNumber(members.length) })} flush>
        <DataTable
          caption={staff.title}
          columns={Object.values(staff.columns)}
          actionsLabel={staff.manage}
        >
          {members.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              isSelf={member.id === context.staff.id}
              timezone={club?.timezone ?? FALLBACK_TIMEZONE}
              dictionary={dictionary}
            />
          ))}
        </DataTable>
      </Card>
    </>
  );
}
