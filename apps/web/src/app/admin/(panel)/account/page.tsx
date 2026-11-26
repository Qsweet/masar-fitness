import { listLiveStaffSessions, type StaffAccount, type StaffSessionView } from "@masar/db";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminForm } from "@/components/admin/admin-form";
import { adminButton, Notice, noticeText } from "@/components/admin/fields";
import { Badge, Ltr, PageHeader, pageStyles, Panel } from "@/components/admin/page-parts";
import { NewPasswordFields } from "@/components/admin/password-fields";
import { FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { changePasswordAction } from "@/server/admin/actions/password";
import { revokeSessionAction } from "@/server/admin/actions/session";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import { describeUserAgent } from "@/server/admin/user-agent";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().account.title };
}

interface SessionRowProps {
  readonly session: StaffSessionView;
  readonly isCurrent: boolean;
  readonly timezone: string;
  readonly text: AdminDictionary["account"];
}

function SessionRow({ session, isCurrent, timezone, text }: SessionRowProps) {
  const started = formatDateTime(session.createdAt, timezone);
  const device = describeUserAgent(session.userAgent);
  return (
    <tr>
      <td data-label={text.columns.device} className={pageStyles.strong}>
        {device === null ? text.unknownDevice : <Ltr>{device}</Ltr>}{" "}
        {isCurrent ? <Badge tone="accent">{text.current}</Badge> : null}
      </td>
      <td data-label={text.columns.ip}>
        <Ltr>{session.ip}</Ltr>
      </td>
      <td data-label={text.columns.started} className={pageStyles.muted}>
        {started}
      </td>
      <td data-label={text.columns.lastSeen} className={pageStyles.muted}>
        {formatDateTime(session.lastSeenAt, timezone)}
      </td>
      <td data-label="" className={pageStyles.end}>
        <form action={revokeSessionAction}>
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            className={adminButton("outline")}
            aria-label={fill(text.revokeLabel, { started })}
          >
            {text.revoke}
          </button>
        </form>
      </td>
    </tr>
  );
}

interface SessionsProps {
  readonly sessions: readonly StaffSessionView[];
  readonly currentId: string;
  readonly timezone: string;
  readonly text: AdminDictionary["account"];
}

function Sessions({ sessions, currentId, timezone, text }: SessionsProps) {
  return (
    <div className={pageStyles.tableWrap}>
      <table className={pageStyles.table} data-testid="sessions-table">
        <caption>{text.sessionsTitle}</caption>
        <thead>
          <tr>
            {Object.values(text.columns).map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
            <th scope="col">
              <span className="sr-only">{text.revoke}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isCurrent={session.id === currentId}
              timezone={timezone}
              text={text}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Profile({ staff, dictionary }: { staff: StaffAccount; dictionary: AdminDictionary }) {
  const { account, roles } = dictionary;
  const facts: readonly (readonly [string, ReactNode])[] = [
    [account.name, staff.displayName],
    [account.email, <Ltr key="email">{staff.email}</Ltr>],
    [account.role, roles[staff.role]],
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

/** حسابي: البيانات، وتغيير كلمة المرور (بالكلمة الحالية)، والجلسات المفتوحة وإلغاؤها. */
export default async function AccountPage(props: PageProps<"/admin/account">) {
  const { staff, session: current } = await requireStaff("account.self");
  const query = await props.searchParams;
  const dictionary = getAdminDictionary();
  const { account, common, errors } = dictionary;
  const [sessions, club] = await Promise.all([
    listLiveStaffSessions(getDb(), staff.id, new Date()),
    staffClub(staff.clubId),
  ]);
  return (
    <>
      <PageHeader title={account.title} lead={account.lead} />
      <Notice text={noticeText(query.done, dictionary)} />
      <Panel title={account.profile}>
        <Profile staff={staff} dictionary={dictionary} />
      </Panel>
      <Panel title={account.passwordTitle} lead={account.passwordLead} narrow>
        <AdminForm
          action={changePasswordAction}
          labels={{ submit: account.passwordSubmit, pending: common.pending, errors }}
        >
          <NewPasswordFields
            idPrefix="account"
            email={staff.email}
            text={dictionary.passwordFields}
            withCurrent
          />
        </AdminForm>
      </Panel>
      <Panel title={account.sessionsTitle} lead={account.sessionsLead}>
        <Sessions
          sessions={sessions}
          currentId={current.id}
          timezone={club?.timezone ?? FALLBACK_TIMEZONE}
          text={account}
        />
      </Panel>
    </>
  );
}
