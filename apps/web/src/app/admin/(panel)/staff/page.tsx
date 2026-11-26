import { listStaff, type StaffAccount } from "@masar/db";
import type { Metadata } from "next";
import Link from "next/link";
import { adminButton } from "@/components/admin/fields";
import { Badge, Ltr, PageHeader, pageStyles } from "@/components/admin/page-parts";
import { ADMIN_ROUTES, FALLBACK_TIMEZONE, staffMemberPath } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
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
      <td data-label={columns.name} className={pageStyles.strong}>
        {member.displayName} {isSelf ? <Badge tone="accent">{staff.you}</Badge> : null}
      </td>
      <td data-label={columns.email}>
        <Ltr>{member.email}</Ltr>
      </td>
      <td data-label={columns.role}>{roles[member.role]}</td>
      <td data-label={columns.status}>
        <Badge tone={member.status === "active" ? "accent" : "muted"}>
          {statuses[member.status]}
        </Badge>
      </td>
      <td data-label={columns.mfa}>{member.totpEnabled ? staff.mfaOn : staff.mfaOff}</td>
      <td data-label={columns.lastLogin} className={pageStyles.muted}>
        {member.lastLoginAt === null ? common.never : formatDateTime(member.lastLoginAt, timezone)}
      </td>
      <td data-label="" className={pageStyles.end}>
        <Link
          href={staffMemberPath(member.id)}
          prefetch={false}
          className={adminButton("outline")}
          aria-label={fill(staff.manageLabel, { name: member.displayName })}
        >
          {staff.manage}
        </Link>
      </td>
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
  const timezone = club?.timezone ?? FALLBACK_TIMEZONE;
  return (
    <>
      <PageHeader title={staff.title} lead={staff.lead}>
        <Link href={ADMIN_ROUTES.staffNew} prefetch={false} className={adminButton("primary")}>
          {staff.add}
        </Link>
      </PageHeader>
      <div className={pageStyles.tableWrap}>
        <table className={pageStyles.table}>
          <caption>{staff.title}</caption>
          <thead>
            <tr>
              {Object.values(staff.columns).map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">{staff.manage}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <StaffRow
                key={member.id}
                member={member}
                isSelf={member.id === context.staff.id}
                timezone={timezone}
                dictionary={dictionary}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
