import { findStaffInClub, type StaffAccount } from "@masar/db";
import { isLockedOut } from "@masar/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StaffControls } from "@/components/admin/staff-controls";
import {
  Alert,
  Badge,
  Card,
  Facts,
  Ltr,
  Notice,
  noticeText,
  PageHeader,
  SecretValue,
} from "@/components/admin/ui/kit";
import { SubmitButton } from "@/components/admin/ui/submit-button";
import { FALLBACK_TIMEZONE } from "@/config/admin";
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

function memberFacts({ member, timezone, now, dictionary }: FactsProps) {
  const { staff, staffMember, roles, common } = dictionary;
  const when = (date: Date | null) =>
    date === null ? common.never : formatDateTime(date, timezone);
  const locked = isLockedOut({ failedLogins: 0, lockedUntil: member.lockedUntil }, now);
  const facts: (readonly [string, ReactNode])[] = [
    [staff.columns.email, <Ltr key="email">{member.email}</Ltr>],
    [staff.columns.role, roles[member.role]],
    [
      staff.columns.mfa,
      <Badge key="mfa" tone={member.totpEnabled ? "success" : "warning"}>
        {member.totpEnabled ? staff.mfaOn : staff.mfaOff}
      </Badge>,
    ],
    [staff.columns.lastLogin, when(member.lastLoginAt)],
    [staffMember.created, when(member.createdAt)],
  ];
  if (locked) {
    facts.push([staffMember.lockedUntil, when(member.lockedUntil)]);
  }
  return facts;
}

interface TemporaryPasswordProps {
  readonly staffId: string;
  readonly password: string;
  readonly text: AdminDictionary["staffMember"];
}

/** الكلمة المؤقتة بعد الإنشاء أو إعادة الضبط: تظهر للمالك حتى يؤكد أنه نسخها. */
function TemporaryPassword({ staffId, password, text }: TemporaryPasswordProps) {
  return (
    <Card title={text.temporaryTitle} description={text.temporaryLead} accent>
      <SecretValue data-testid="temporary-password">{password}</SecretValue>
      <form action={dismissTemporaryPasswordAction}>
        <input type="hidden" name="staffId" value={staffId} />
        <SubmitButton>{text.temporaryDismiss}</SubmitButton>
      </form>
    </Card>
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
  const timezone = club?.timezone ?? FALLBACK_TIMEZONE;
  return (
    <>
      <PageHeader
        title={member.displayName}
        badge={
          <Badge tone={member.status === "active" ? "success" : "neutral"}>
            {statuses[member.status]}
          </Badge>
        }
      />
      <Notice text={noticeText(query.done, dictionary)} />
      {temporary === undefined ? null : (
        <TemporaryPassword staffId={member.id} password={temporary} text={staffMember} />
      )}
      <Card title={staffMember.details}>
        <Facts items={memberFacts({ member, timezone, now: new Date(), dictionary })} />
      </Card>
      {member.id === context.staff.id ? (
        <Alert tone="info">{staffMember.selfNote}</Alert>
      ) : (
        <StaffControls member={member} dictionary={dictionary} />
      )}
    </>
  );
}
