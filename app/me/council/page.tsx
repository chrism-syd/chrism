import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '@/app/app-header';
import ConfirmActionButton from '@/app/components/confirm-action-button';
import MemberSearchField from '@/app/components/member-search-field';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import {
  addOfficerTermAction,
  grantCouncilAdminAction,
  removeOfficerTermAction,
  revokeCouncilAdminAction,
  saveOfficerRoleEmailAction,
  updateCouncilDetailsAction,
} from './actions';
import {
  formatOfficerLabel,
  isAutomaticCouncilAdminTerm,
  OFFICER_ROLE_OPTIONS,
  type OfficerScopeCode,
} from '@/lib/members/officer-roles';
import { decryptPeopleRecords } from '@/lib/security/pii';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type OrganizationRow = {
  id: string;
  display_name: string;
  preferred_name: string | null;
};

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

type AdminAssignmentRow = {
  id: string;
  person_id: string | null;
  user_id: string | null;
  grantee_email: string | null;
};

type OfficerTermRow = {
  id: string;
  person_id: string;
  office_scope_code: OfficerScopeCode;
  office_code: string;
  office_rank: number | null;
  service_start_year: number;
  service_end_year: number | null;
  office_label: string;
};


type OfficerRoleEmailRow = {
  id: string;
  council_id: string;
  office_scope_code: OfficerScopeCode;
  office_code: string;
  office_rank: number | null;
  email: string;
};

type AdminDisplayRow = {
  id: string;
  personId: string | null;
  label: string;
  automaticAdminLabels: string[];
  currentOfficerLabels: string[];
  sortPriority: number;
};

function memberName(member: MemberRow) {
  return `${member.first_name} ${member.last_name}`.trim();
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function officeSortPriority(term: Pick<OfficerTermRow, 'office_scope_code' | 'office_code' | 'office_rank'>) {
  const key = `${term.office_scope_code}:${term.office_code}`;

  switch (key) {
    case 'council:grand_knight':
      return 1;
    case 'council:deputy_grand_knight':
      return 2;
    case 'council:financial_secretary':
      return 3;
    case 'council:chancellor':
      return 4;
    case 'council:recorder':
      return 5;
    case 'council:treasurer':
      return 6;
    case 'council:advocate':
      return 7;
    case 'council:warden':
      return 8;
    case 'council:inside_guard':
      return 9;
    case 'council:outside_guard':
      return 10;
    case 'council:trustee':
      return 20 + (term.office_rank ?? 0);
    default:
      return 100;
  }
}

function adminSortPriority(labels: string[]) {
  const normalized = labels.map((label) => label.toLowerCase());

  if (normalized.some((label) => label.includes('grand knight'))) {
    return 1;
  }

  if (normalized.some((label) => label.includes('deputy grand knight'))) {
    return 2;
  }

  if (normalized.some((label) => label.includes('financial secretary'))) {
    return 3;
  }

  return 100;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CouncilDetailsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null;
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null;

  const { admin, permissions, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
  });

  if (!permissions.organizationId) {
    redirect('/me');
  }

  const [{ data: memberData }, { data: assignmentData }, { data: officerData }, { data: officerRoleEmailData }, { data: organizationData }] = await Promise.all([
    admin
      .from('people')
      .select('id, first_name, last_name, email')
      .eq('council_id', council.id)
      .eq('primary_relationship_code', 'member')
      .is('archived_at', null)
      .is('merged_into_person_id', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true }),
    admin
      .from('organization_admin_assignments')
      .select('id, person_id, user_id, grantee_email')
      .eq('organization_id', permissions.organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    admin
      .from('person_officer_terms')
      .select(
        'id, person_id, office_scope_code, office_code, office_rank, service_start_year, service_end_year, office_label'
      )
      .eq('council_id', council.id)
      .is('service_end_year', null)
      .order('service_start_year', { ascending: false }),
    admin
      .from('officer_role_emails')
      .select('id, council_id, office_scope_code, office_code, office_rank, email')
      .eq('council_id', council.id)
      .eq('is_active', true)
      .order('office_scope_code', { ascending: true }),
    admin
      .from('organizations')
      .select('id, display_name, preferred_name')
      .eq('id', permissions.organizationId)
      .maybeSingle(),
  ]);

  const members = decryptPeopleRecords((memberData as MemberRow[] | null) ?? []);
  const assignments = (assignmentData as AdminAssignmentRow[] | null) ?? [];
  const officerTerms = (officerData as OfficerTermRow[] | null) ?? [];
  const officerRoleEmails = (officerRoleEmailData as OfficerRoleEmailRow[] | null) ?? [];
  const organization = (organizationData as OrganizationRow | null) ?? null;

  if (!council) {
    redirect('/me');
  }

  const memberById = new Map(members.map((member) => [member.id, member]));
  const memberByEmail = new Map(
    members
      .map((member) => [normalizeEmail(member.email), member] as const)
      .filter((entry): entry is [string, MemberRow] => Boolean(entry[0]))
  );

  const memberOptions = members.map((member) => ({
    id: member.id,
    name: memberName(member),
    email: member.email,
  }));
  const officerRoleEmailByKey = new Map(
    officerRoleEmails.map((row) => [
      `${row.office_scope_code}:${row.office_code}:${row.office_rank ?? 'none'}`,
      row.email,
    ])
  );


  const currentOfficerLabelsByPersonId = new Map<string, string[]>();
  const currentOfficerPriorityByPersonId = new Map<string, number>();

  for (const term of officerTerms) {
    const labels = currentOfficerLabelsByPersonId.get(term.person_id) ?? [];
    const label = formatOfficerLabel(term);
    if (!labels.includes(label)) {
      currentOfficerLabelsByPersonId.set(term.person_id, [...labels, label]);
    }

    const nextPriority = officeSortPriority(term);
    const existingPriority = currentOfficerPriorityByPersonId.get(term.person_id);
    if (existingPriority == null || nextPriority < existingPriority) {
      currentOfficerPriorityByPersonId.set(term.person_id, nextPriority);
    }
  }

  const automaticAdminTerms = officerTerms.filter((term) => isAutomaticCouncilAdminTerm(term));
  const automaticAdminLabelsByPersonId = new Map<string, string[]>();

  for (const term of automaticAdminTerms) {
    const existing = automaticAdminLabelsByPersonId.get(term.person_id) ?? [];
    const nextLabel = formatOfficerLabel(term);

    if (!existing.includes(nextLabel)) {
      automaticAdminLabelsByPersonId.set(term.person_id, [...existing, nextLabel]);
    }
  }

  const currentAdmins: AdminDisplayRow[] = assignments.map((assignment) => {
    const matchedMember = assignment.person_id
      ? memberById.get(assignment.person_id) ?? null
      : memberByEmail.get(normalizeEmail(assignment.grantee_email) ?? '') ?? null;
    const automaticAdminLabels = matchedMember
      ? automaticAdminLabelsByPersonId.get(matchedMember.id) ?? []
      : [];
    const currentOfficerLabels = matchedMember
      ? currentOfficerLabelsByPersonId.get(matchedMember.id) ?? []
      : [];

    return {
      id: assignment.id,
      personId: matchedMember?.id ?? assignment.person_id ?? null,
      label: matchedMember ? memberName(matchedMember) : assignment.grantee_email ?? 'Unassigned admin grant',
      automaticAdminLabels,
      currentOfficerLabels,
      sortPriority: matchedMember
        ? adminSortPriority(currentOfficerLabels.length > 0 ? currentOfficerLabels : automaticAdminLabels)
        : 100,
    };
  });

  const implicitAutomaticAdmins = [...automaticAdminLabelsByPersonId.entries()]
    .filter(([personId]) => {
      const member = memberById.get(personId);
      const memberEmail = normalizeEmail(member?.email);

      return !assignments.some((assignment) => {
        if (assignment.person_id === personId) {
          return true;
        }

        return memberEmail !== null && normalizeEmail(assignment.grantee_email) === memberEmail;
      });
    })
    .map(([personId, automaticAdminLabels]) => {
      const person = memberById.get(personId);
      return person
        ? {
            id: `implicit-${personId}`,
            personId,
            label: memberName(person),
            automaticAdminLabels,
            currentOfficerLabels: currentOfficerLabelsByPersonId.get(personId) ?? [],
            sortPriority: adminSortPriority(currentOfficerLabelsByPersonId.get(personId) ?? automaticAdminLabels),
          }
        : null;
    })
    .filter(Boolean) as AdminDisplayRow[];

  const sortedAdmins = [...currentAdmins, ...implicitAutomaticAdmins].sort((left, right) => {
    if (left.sortPriority !== right.sortPriority) {
      return left.sortPriority - right.sortPriority;
    }

    return left.label.localeCompare(right.label);
  });

  const sortedOfficerTerms = [...officerTerms].sort((left, right) => {
    const priorityDifference = officeSortPriority(left) - officeSortPriority(right);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const leftName = memberName(memberById.get(left.person_id) ?? { id: '', first_name: 'Unknown', last_name: 'Member', email: null });
    const rightName = memberName(memberById.get(right.person_id) ?? { id: '', first_name: 'Unknown', last_name: 'Member', email: null });
    return leftName.localeCompare(rightName);
  });

  const heroName = organization?.preferred_name ?? organization?.display_name ?? council.name ?? 'Organization';

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Organization settings</p>
          <h1 className="qv-title">{heroName}</h1>
          <p className="qv-subtitle">Manage the name members see, current officers, and app admins.</p>
        </section>

        {noticeMessage ? (
          <section className="qv-card" style={{ borderColor: 'var(--divider-strong)' }}>
            <p style={{ margin: 0, color: 'var(--text-primary)' }}>{noticeMessage}</p>
          </section>
        ) : null}

        {errorMessage ? (
          <section className="qv-card qv-error">
            <p style={{ margin: 0 }}>{errorMessage}</p>
          </section>
        ) : null}

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Name and identity</h2>
              <p className="qv-section-subtitle">
                Keep the formal organization name on file, and optionally set a shorter public name for day-to-day use.
              </p>
            </div>
          </div>

          <form action={updateCouncilDetailsAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Council number</span>
                <input value={council.council_number ?? ''} readOnly disabled />
              </label>
              <label className="qv-control">
                <span className="qv-label">Formal organization name</span>
                <input
                  name="display_name"
                  defaultValue={organization?.display_name ?? council.name ?? ''}
                  required
                  placeholder="Formal organization name"
                />
              </label>
            </div>

            <div className="qv-form-row">
              <label className="qv-control">
                <span className="qv-label">Preferred public name</span>
                <input
                  name="preferred_name"
                  defaultValue={organization?.preferred_name ?? ''}
                  placeholder="Optional shorter name members will see"
                />
              </label>
            </div>

            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">Save organization details</button>
            </div>
          </form>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Organization admins</h2>
              <p className="qv-section-subtitle">Grand Knight and Financial Secretary access are automatic. Other admins can be granted here.</p>
            </div>
          </div>

          <form action={grantCouncilAdminAction} className="qv-form-grid">
            <MemberSearchField
              name="person_id"
              label="Member"
              members={memberOptions}
              placeholder="Type a member name"
              required
            />
            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">Grant admin access</button>
            </div>
          </form>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
            {sortedAdmins.map((adminRow) => {
              const roleLabel = adminRow.automaticAdminLabels.length > 0
                ? `${adminRow.automaticAdminLabels.join(', ')} admin`
                : adminRow.currentOfficerLabels.length > 0
                  ? `${adminRow.currentOfficerLabels[0]} admin`
                  : 'Organization admin';

              return (
                <div
                  key={adminRow.id}
                  style={{
                    border: '1px solid var(--divider)',
                    borderRadius: 16,
                    background: 'var(--bg-sunken)',
                    padding: 16,
                    display: 'grid',
                    gap: 10,
                    alignContent: 'start',
                  }}
                >
                  <div className="qv-detail-label">{roleLabel}</div>
                  <div className="qv-detail-value">
                    {adminRow.personId ? (
                      <Link href={`/members/${adminRow.personId}`} className="qv-member-link" style={{ display: 'inline' }}>
                        {adminRow.label}
                      </Link>
                    ) : (
                      adminRow.label
                    )}
                  </div>
                  {adminRow.automaticAdminLabels.length === 0 && adminRow.id.startsWith('implicit-') === false ? (
                    <ConfirmActionButton
                      triggerLabel="Remove admin"
                      confirmTitle="Remove admin access?"
                      confirmDescription={`This will remove manual admin access for ${adminRow.label}.`}
                      confirmLabel="Remove admin"
                      danger
                      action={revokeCouncilAdminAction}
                      hiddenFields={[{ name: 'assignment_id', value: adminRow.id }]}
                    />
                  ) : null}
                </div>
              );
            })}
            {sortedAdmins.length === 0 ? (
              <div className="qv-empty" style={{ gridColumn: '1 / -1' }}>
                <p className="qv-empty-text">No admins are configured yet.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Officer assignments</h2>
              <p className="qv-section-subtitle">Record service years and optionally grant admin access for the assigned officer.</p>
            </div>
          </div>

          <form action={addOfficerTermAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-3">
              <MemberSearchField
                name="person_id"
                label="Member"
                members={memberOptions}
                placeholder="Type a member name"
                required
              />
              <label className="qv-control">
                <span className="qv-label">Role</span>
                <select name="role_key" defaultValue="">
                  <option value="" disabled>
                    Choose a role
                  </option>
                  {OFFICER_ROLE_OPTIONS.map((option) => (
                    <option key={`${option.scope}:${option.code}`} value={`${option.scope}:${option.code}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="qv-control">
                <span className="qv-label">Rank</span>
                <input name="office_rank" type="number" min={1} step={1} placeholder="Only for ranked trustees or delegates" />
              </label>
            </div>

            <div className="qv-form-row qv-form-row-3">
              <label className="qv-control">
                <span className="qv-label">Start year</span>
                <input name="service_start_year" type="number" min={1900} max={3000} required />
              </label>
              <label className="qv-control">
                <span className="qv-label">End year</span>
                <input name="service_end_year" type="number" min={1900} max={3000} placeholder="Leave blank if current" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Grant admin access</span>
                <select name="grant_admin" defaultValue="false">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </label>
            </div>

            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Official office email</span>
                <input name="official_email" type="email" placeholder="Optional office inbox for this role" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Notes</span>
                <textarea name="notes" placeholder="Optional notes about this term" />
              </label>
            </div>

            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">Add officer term</button>
            </div>
          </form>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
            {sortedOfficerTerms.map((term) => {
              const member = memberById.get(term.person_id);
              return (
                <div
                  key={term.id}
                  style={{
                    border: '1px solid var(--divider)',
                    borderRadius: 16,
                    background: 'var(--bg-sunken)',
                    padding: 16,
                    display: 'grid',
                    gap: 10,
                    alignContent: 'start',
                  }}
                >
                  <div className="qv-detail-label">{formatOfficerLabel(term)}</div>
                  <div className="qv-detail-value">
                    {member ? (
                      <Link href={`/members/${member.id}`} className="qv-member-link" style={{ display: 'inline' }}>
                        {memberName(member)}
                      </Link>
                    ) : (
                      'Unknown member'
                    )}
                  </div>
                  <div className="qv-inline-message">
                    {term.service_start_year}
                    {term.service_end_year ? ` to ${term.service_end_year}` : ' to present'}
                  </div>
                  <form action={saveOfficerRoleEmailAction} style={{ display: 'grid', gap: 8 }}>
                    <input type="hidden" name="term_id" value={term.id} />
                    <label className="qv-control" style={{ gap: 6 }}>
                      <span className="qv-label">Official office email</span>
                      <input
                        type="email"
                        name="official_email"
                        defaultValue={officerRoleEmailByKey.get(`${term.office_scope_code}:${term.office_code}:${term.office_rank ?? 'none'}`) ?? ''}
                        placeholder="office@example.org"
                      />
                    </label>
                    <button type="submit" className="qv-link-button">Save office email</button>
                    <p className="qv-member-meta" style={{ margin: 0 }}>
                      This email follows the office, not the member profile.
                    </p>
                  </form>
                  <ConfirmActionButton
                    triggerLabel="End term"
                    confirmTitle="End officer term?"
                    confirmDescription={`This will end ${formatOfficerLabel(term)} for ${member ? memberName(member) : 'this member'}. The service history will stay on file. If this was a Grand Knight term, Past Grand Knight honorifics will still come from the completed record.`}
                    confirmLabel="End term"
                    danger
                    action={removeOfficerTermAction}
                    hiddenFields={[{ name: 'term_id', value: term.id }]}
                  />
                </div>
              );
            })}
            {sortedOfficerTerms.length === 0 ? (
              <div className="qv-empty" style={{ gridColumn: '1 / -1' }}>
                <p className="qv-empty-text">No officer assignments recorded yet.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
