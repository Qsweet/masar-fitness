import { findStaffInClub, type StaffAccount } from "@masar/db";
import { isLockedOut } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { adminButton, Notice, noticeText } from "@/components/admin/fields";
import { Badge, Ltr, PageHeader, pageStyles, Panel } from "@/components/admin/page-parts";
import { StaffControls } from "@/components/admin/staff-controls";
import { ADMIN_ROUTES, FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { dismissTemporaryPasswordAction } from "@/server/admin/actions/staff";
import { staffClub } from "@/server/admin/club";
import { readFlash } from "@/server/admin/flash";
import { isUuid } from "@/server/admin/form";
import { requireStaff } from "@/server/admin/guard";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().staff.title };
}

interface FactsProps {
  readonly member: StaffAccount;
  readonly timezone: string;
  readonly now: Date;
  readonly dictionary: AdminDictionary;
}

function Facts({ member, timezone, now, dictionary }: FactsProps) {
  const { staff, staffMember, roles, common } = dictionary;
  const when = (date: Date | null) =>
    date === null ? common.never : formatDateTime(date, timezone);
  const locked = isLockedOut({ failedLogins: 0, lockedUntil: member.lockedUntil }, now);
  const facts: readonly (readonly [string, ReactNode])[] = [
    [staff.columns.email, <Ltr key="email">{member.email}</Ltr>],
    [staff.columns.role, roles[member.role]],
    [staff.columns.mfa, member.totpEnabled ? staff.mfaOn : staff.mfaOff],
    [staff.columns.lastLogin, when(member.lastLoginAt)],
    [staffMember.created, when(member.createdAt)],
    ...(locked ? [[staffMember.lockedUntil, when(member.lockedUntil)] as const] : []),
  ];
  return (
    <dl className={pageStyles.facts}>
      {facts.map(([label, value]) => (
        <div key={label} className={pageStyles.fact}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface TemporaryPasswordProps {
  readonly staffId: string;
  readonly password: string;
  readonly text: AdminDictionary["staffMember"];
}

/** الكلمة المؤقتة بعد الإنشاء أو إعادة الضبط: تظهر للمالك حتى يؤكد أنه نسخها. */
function TemporaryPassword({ staffId, password, text }: TemporaryPasswordProps) {
  return (
    <section className={pageStyles.secret} aria-labelledby="temporary-password-title">
      <h2 id="temporary-password-title" className={pageStyles.panelTitle}>
        {text.temporaryTitle}
      </h2>
      <p>{text.temporaryLead}</p>
      <code className={pageStyles.secretValue} data-testid="temporary-password">
        {password}
      </code>
      <form action={dismissTemporaryPasswordAction}>
        <input type="hidden" name="staffId" value={staffId} />
        <button type="submit" className={adminButton("outline")}>
          {text.temporaryDismiss}
        </button>
      </form>
    </section>
  );
}

/** الكلمة المؤقتة المنتظرة لهذا الموظف في كوكي المالك، إن وُجدت. */
async function temporaryPasswordFor(
  viewerId: string,
  staffId: string,
): Promise<string | undefined> {
  const flash = await readFlash(viewerId);
  return flash?.kind === "temporary_password" && flash.subject === staffId
    ? flash.values[0]
    : undefined;
}

/** صفحة موظف: بياناته وأفعال المالك عليه. حسابه هو يُدار من «حسابي». */
export default async function StaffMemberPage(props: PageProps<"/admin/staff/[id]">) {
  const context = await requireStaff("staff.manage");
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const member = isUuid(id) ? await findStaffInClub(getDb(), context.staff.clubId, id) : null;
  if (member === null) {
    notFound();
  }
  const dictionary = getAdminDictionary();
  const { staffMember, statuses } = dictionary;
  const [club, temporary] = await Promise.all([
    staffClub(context.staff.clubId),
    temporaryPasswordFor(context.staff.id, member.id),
  ]);
  return (
    <>
      <PageHeader
        title={member.displayName}
        back={{ href: ADMIN_ROUTES.staff, label: staffMember.backToList }}
      >
        <Badge tone={member.status === "active" ? "accent" : "muted"}>
          {statuses[member.status]}
        </Badge>
      </PageHeader>
      <Notice text={noticeText(query.done, dictionary)} />
      {temporary === undefined ? null : (
        <TemporaryPassword staffId={member.id} password={temporary} text={staffMember} />
      )}
      <Panel title={staffMember.details}>
        <Facts
          member={member}
          timezone={club?.timezone ?? FALLBACK_TIMEZONE}
          now={new Date()}
          dictionary={dictionary}
        />
      </Panel>
      {member.id === context.staff.id ? (
        <p className={pageStyles.muted}>{staffMember.selfNote}</p>
      ) : (
        <StaffControls member={member} dictionary={dictionary} />
      )}
    </>
  );
}
