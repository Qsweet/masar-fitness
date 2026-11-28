import { listLiveStaffSessions, type StaffSessionView } from "@masar/db";
import type { Metadata } from "next";
import { AdminForm } from "@/components/admin/admin-form";
import { NewPasswordFields } from "@/components/admin/password-fields";
import { Cell, DataTable } from "@/components/admin/ui/data-table";
import { Badge, Facts, Ltr, Notice, noticeText, PageHeader, Tabs } from "@/components/admin/ui/kit";
import { SettingsSection, SettingsStack } from "@/components/admin/ui/section";
import { SubmitButton } from "@/components/admin/ui/submit-button";
import { ADMIN_ROUTES, FALLBACK_TIMEZONE } from "@/config/admin";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/admin";
import { formatDateTime } from "@/i18n/admin/format";
import { fill } from "@/i18n/fill";
import { changePasswordAction } from "@/server/admin/actions/password";
import { revokeSessionAction } from "@/server/admin/actions/session";
import { staffClub } from "@/server/admin/club";
import { requireStaff } from "@/server/admin/guard";
import type { StaffContext } from "@/server/admin/session";
import { describeUserAgent } from "@/server/admin/user-agent";
import { getDb } from "@/server/db";

export function generateMetadata(): Metadata {
  return { title: getAdminDictionary().account.title };
}

const TABS = ["password", "sessions"] as const;
type Tab = (typeof TABS)[number];
/** التنبيه الذي يعود بعد إلغاء جلسة يفتح تبويب الجلسات. */
const SESSIONS_NOTICE = "session_revoked";

function currentTab(tab: unknown, done: unknown): Tab {
  const requested = TABS.find((candidate) => candidate === tab);
  return requested ?? (done === SESSIONS_NOTICE ? "sessions" : "password");
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
      <Cell label={text.columns.device} strong nowrap>
        {device === null ? text.unknownDevice : <Ltr>{device}</Ltr>}{" "}
        {isCurrent ? <Badge tone="accent">{text.current}</Badge> : null}
      </Cell>
      <Cell label={text.columns.ip} muted>
        <Ltr>{session.ip}</Ltr>
      </Cell>
      <Cell label={text.columns.started} muted nowrap>
        {started}
      </Cell>
      <Cell label={text.columns.lastSeen} muted nowrap>
        {formatDateTime(session.lastSeenAt, timezone)}
      </Cell>
      <Cell label="" align="end">
        <form action={revokeSessionAction}>
          <input type="hidden" name="sessionId" value={session.id} />
          <SubmitButton size="small" variant="danger" label={fill(text.revokeLabel, { started })}>
            {text.revoke}
          </SubmitButton>
        </form>
      </Cell>
    </tr>
  );
}

async function SessionsCard({ context }: { readonly context: StaffContext }) {
  const { account } = getAdminDictionary();
  const [sessions, club] = await Promise.all([
    listLiveStaffSessions(getDb(), context.staff.id, new Date()),
    staffClub(context.staff.clubId),
  ]);
  return (
    <SettingsSection title={account.sessionsTitle} description={account.sessionsLead} flush>
      <DataTable
        caption={account.sessionsTitle}
        columns={Object.values(account.columns)}
        actionsLabel={account.revoke}
        testId="sessions-table"
      >
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isCurrent={session.id === context.session.id}
            timezone={club?.timezone ?? FALLBACK_TIMEZONE}
            text={account}
          />
        ))}
      </DataTable>
    </SettingsSection>
  );
}

function PasswordCard({ context }: { readonly context: StaffContext }) {
  const dictionary = getAdminDictionary();
  const { account, errors } = dictionary;
  return (
    <SettingsSection title={account.passwordTitle} description={account.passwordLead}>
      <AdminForm action={changePasswordAction} labels={{ submit: account.passwordSubmit, errors }}>
        <NewPasswordFields
          idPrefix="account"
          email={context.staff.email}
          text={dictionary.passwordFields}
          withCurrent
        />
      </AdminForm>
    </SettingsSection>
  );
}

/** حسابي: البيانات، ثم تبويبان: كلمة المرور (بالكلمة الحالية)، والجلسات المفتوحة وإلغاؤها. */
export default async function AccountPage(props: PageProps<"/admin/account">) {
  const context = await requireStaff("account.self");
  const query = await props.searchParams;
  const dictionary = getAdminDictionary();
  const { account, roles } = dictionary;
  const { staff } = context;
  const tab = currentTab(query.tab, query.done);
  return (
    <>
      <PageHeader title={account.title} description={account.lead} />
      <Notice text={noticeText(query.done, dictionary)} />
      <SettingsStack>
        <SettingsSection title={account.profile} description={account.profileLead}>
          <Facts
            items={[
              [account.name, staff.displayName],
              [account.email, <Ltr key="email">{staff.email}</Ltr>],
              [account.role, roles[staff.role]],
            ]}
          />
        </SettingsSection>
      </SettingsStack>
      <Tabs
        label={account.tabsLabel}
        current={tab}
        tabs={TABS.map((id) => ({
          id,
          label: account.tabs[id],
          href: `${ADMIN_ROUTES.account}?tab=${id}`,
        }))}
      />
      <SettingsStack>
        {tab === "sessions" ? (
          <SessionsCard context={context} />
        ) : (
          <PasswordCard context={context} />
        )}
      </SettingsStack>
    </>
  );
}
