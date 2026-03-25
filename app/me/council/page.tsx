import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import MemberSearchField from '@/app/components/member-search-field'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import {
  addOfficerTermAction,
  grantCouncilAdminAction,
  inviteCouncilAdminByEmailAction,
  removeOfficerTermAction,
  revokeCouncilAdminAction,
  revokeCouncilAdminInvitationAction,
  saveOfficerRoleEmailAction,
  updateCouncilDetailsAction,
} from './actions'
import {
  formatOfficerLabel,
  isAutomaticCouncilAdminTerm,
  OFFICER_ROLE_OPTIONS,
  type OfficerScopeCode,
} from '@/lib/members/officer-roles'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { getOrganizationAdminManagerAccess } from '@/lib/organizations/admin-managers'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type OrganizationRow = {
  id: string
  display_name: string
  preferred_name: string | null
}

type MemberRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

type AdminAssignmentRow = {
  id: string
  person_id: string | null
  user_id: string | null
  grantee_email: string | null
  source_code: 'manual_assignment' | 'approved_claim' | 'admin_invitation' | null
  grant_notes: string | null
}

type PendingInvitationRow = {
  id: string
  invitee_email: string
  invitee_name: string | null
  notes: string | null
  status_code: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
}

type OfficerTermRow = {
  id: string
  person_id: string
  office_scope_code: OfficerScopeCode
  office_code: string
  office_rank: number | null
  service_start_year: number
  service_end_year: number | null
  office_label: string
}

type OfficerRoleEmailRow = {
  id: string
  council_id: string
  office_scope_code: OfficerScopeCode
  office_code: string
  office_rank: number | null
  email: string
}

type AdminDisplayRow = {
  id: string
  assignmentId: string | null
  personId: string | null
  label: string
  automaticAdminLabels: string[]
  currentOfficerLabels: string[]
  sourceBadge: string
  grantNotes: string | null
  sortPriority: number
}

function memberName(member: MemberRow) {
  return `${member.first_name} ${member.last_name}`.trim()
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function officeSortPriority(term: Pick<OfficerTermRow, 'office_scope_code' | 'office_code' | 'office_rank'>) {
  const key = `${term.office_scope_code}:${term.office_code}`

  switch (key) {
    case 'council:grand_knight':
      return 1
    case 'council:financial_secretary':
      return 2
    case 'council:deputy_grand_knight':
      return 3
    case 'council:chancellor':
      return 4
    case 'council:recorder':
      return 5
    case 'council:treasurer':
      return 6
    case 'council:advocate':
      return 7
    case 'council:warden':
      return 8
    case 'council:inside_guard':
      return 9
    case 'council:outside_guard':
      return 10
    case 'council:trustee':
      return 20 + (term.office_rank ?? 0)
    default:
      return 100
  }
}

function adminSortPriority(labels: string[]) {
  const normalized = labels.map((label) => label.toLowerCase())

  if (normalized.some((label) => label.includes('grand knight'))) {
    return 1
  }

  if (normalized.some((label) => label.includes('financial secretary'))) {
    return 2
  }

  if (normalized.some((label) => label.includes('deputy grand knight'))) {
    return 3
  }

  return 100
}

function assignmentSourceLabel(sourceCode: AdminAssignmentRow['source_code']) {
  if (sourceCode === 'approved_claim') return 'Approved claim'
  if (sourceCode === 'admin_invitation') return 'Admin invite'
  return 'Manual assignment'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CouncilDetailsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const { admin, permissions, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
  })

  if (!permissions.organizationId) {
    redirect('/me')
  }

  const adminManagerAccess = await getOrganizationAdminManagerAccess({
    permissions,
    councilId: council.id,
  })

  const [
    { data: memberData },
    { data: assignmentData },
    { data: officerData },
    { data: officerRoleEmailData },
    { data: pendingInvitationData },
    { data: organizationData },
  ] = await Promise.all([
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
      .select('id, person_id, user_id, grantee_email, source_code, grant_notes')
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
      .from('organization_admin_invitations')
      .select('id, invitee_email, invitee_name, notes, status_code, expires_at')
      .eq('organization_id', permissions.organizationId)
      .eq('status_code', 'pending')
      .order('created_at', { ascending: false }),
    admin
      .from('organizations')
      .select('id, display_name, preferred_name')
      .eq('id', permissions.organizationId)
      .maybeSingle(),
  ])

  const members = decryptPeopleRecords((memberData as MemberRow[] | null) ?? [])
  const assignments = (assignmentData as AdminAssignmentRow[] | null) ?? []
  const officerTerms = (officerData as OfficerTermRow[] | null) ?? []
  const officerRoleEmails = (officerRoleEmailData as OfficerRoleEmailRow[] | null) ?? []
  const pendingInvitations = (pendingInvitationData as PendingInvitationRow[] | null) ?? []
  const organization = (organizationData as OrganizationRow | null) ?? null

  const memberById = new Map(members.map((member) => [member.id, member]))
  const memberByEmail = new Map(
    members
      .map((member) => [normalizeEmail(member.email), member] as const)
      .filter((entry): entry is [string, MemberRow] => Boolean(entry[0]))
  )

  const memberOptions = members.map((member) => ({
    id: member.id,
    name: memberName(member),
    email: member.email,
  }))
  const officerRoleEmailByKey = new Map(
    officerRoleEmails.map((row) => [
      `${row.office_scope_code}:${row.office_code}:${row.office_rank ?? 'none'}`,
      row.email,
    ])
  )

  const currentOfficerLabelsByPersonId = new Map<string, string[]>()

  for (const term of officerTerms) {
    const labels = currentOfficerLabelsByPersonId.get(term.person_id) ?? []
    const label = formatOfficerLabel(term)
    if (!labels.includes(label)) {
      currentOfficerLabelsByPersonId.set(term.person_id, [...labels, label])
    }
  }

  const automaticAdminTerms = officerTerms.filter((term) => isAutomaticCouncilAdminTerm(term))
  const automaticAdminLabelsByPersonId = new Map<string, string[]>()

  for (const term of automaticAdminTerms) {
    const existing = automaticAdminLabelsByPersonId.get(term.person_id) ?? []
    const nextLabel = formatOfficerLabel(term)
    if (!existing.includes(nextLabel)) {
      automaticAdminLabelsByPersonId.set(term.person_id, [...existing, nextLabel])
    }
  }

  const currentAdmins: AdminDisplayRow[] = assignments.map((assignment) => {
    const matchedMember = assignment.person_id
      ? memberById.get(assignment.person_id) ?? null
      : memberByEmail.get(normalizeEmail(assignment.grantee_email) ?? '') ?? null
    const automaticAdminLabels = matchedMember ? automaticAdminLabelsByPersonId.get(matchedMember.id) ?? [] : []
    const currentOfficerLabels = matchedMember ? currentOfficerLabelsByPersonId.get(matchedMember.id) ?? [] : []

    return {
      id: assignment.id,
      assignmentId: assignment.id,
      personId: matchedMember?.id ?? assignment.person_id ?? null,
      label: matchedMember ? memberName(matchedMember) : assignment.grantee_email ?? 'Manual admin grant',
      automaticAdminLabels,
      currentOfficerLabels,
      sourceBadge: assignmentSourceLabel(assignment.source_code),
      grantNotes: assignment.grant_notes,
      sortPriority: matchedMember
        ? adminSortPriority(currentOfficerLabels.length > 0 ? currentOfficerLabels : automaticAdminLabels)
        : 100,
    }
  })

  const implicitAutomaticAdmins = [...automaticAdminLabelsByPersonId.entries()]
    .filter(([personId]) => {
      const member = memberById.get(personId)
      const memberEmail = normalizeEmail(member?.email)

      return !assignments.some((assignment) => {
        if (assignment.person_id === personId) {
          return true
        }

        return memberEmail !== null && normalizeEmail(assignment.grantee_email) === memberEmail
      })
    })
    .map(([personId, automaticAdminLabels]) => {
      const person = memberById.get(personId)
      return person
        ? {
            id: `implicit-${personId}`,
            assignmentId: null,
            personId,
            label: memberName(person),
            automaticAdminLabels,
            currentOfficerLabels: currentOfficerLabelsByPersonId.get(personId) ?? [],
            sourceBadge: 'Officer role',
            grantNotes: null,
            sortPriority: adminSortPriority(currentOfficerLabelsByPersonId.get(personId) ?? automaticAdminLabels),
          }
        : null
    })
    .filter(Boolean) as AdminDisplayRow[]

  const sortedAdmins = [...currentAdmins, ...implicitAutomaticAdmins].sort((left, right) => {
    if (left.sortPriority !== right.sortPriority) {
      return left.sortPriority - right.sortPriority
    }

    return left.label.localeCompare(right.label)
  })

  const sortedOfficerTerms = [...officerTerms].sort((left, right) => {
    const priorityDifference = officeSortPriority(left) - officeSortPriority(right)
    if (priorityDifference !== 0) {
      return priorityDifference
    }

    const leftName = memberName(memberById.get(left.person_id) ?? { id: '', first_name: 'Unknown', last_name: 'Member', email: null })
    const rightName = memberName(memberById.get(right.person_id) ?? { id: '', first_name: 'Unknown', last_name: 'Member', email: null })
    return leftName.localeCompare(rightName)
  })

  const heroName = organization?.preferred_name ?? organization?.display_name ?? council.name ?? 'Organization'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Organization settings</p>
          <h1 className="qv-title">{heroName}</h1>
          <p className="qv-subtitle">Manage the name members see, current officers, claims, and app admins.</p>
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
              <p className="qv-section-subtitle">Grand Knight and Financial Secretary access are automatic. Other admins can be granted, invited, or removed here.</p>
            </div>
            {permissions.isSuperAdmin ? (
              <div className="qv-form-actions" style={{ margin: 0 }}>
                <Link href="/super-admin/organization-claims" className="qv-link-button qv-button-secondary">
                  Review claim queue
                </Link>
              </div>
            ) : null}
          </div>

          {adminManagerAccess.canManageAdmins ? (
            <>
              <form action={grantCouncilAdminAction} className="qv-form-grid">
                <MemberSearchField
                  name="person_id"
                  label="Member"
                  members={memberOptions}
                  placeholder="Type a member name"
                  required
                />
                <label className="qv-control">
                  <span className="qv-label">Onboarding notes</span>
                  <textarea name="grant_notes" placeholder="Optional notes about why this member is being granted admin access." rows={3} />
                </label>
                <div className="qv-form-actions">
                  <button type="submit" className="qv-button-primary">Grant member admin access</button>
                </div>
              </form>

              <form action={inviteCouncilAdminByEmailAction} className="qv-form-grid" style={{ marginTop: 20 }}>
                <div className="qv-form-row qv-form-row-2">
                  <label className="qv-control">
                    <span className="qv-label">Invitee name</span>
                    <input name="invitee_name" placeholder="e.g. John Smith" />
                  </label>
                  <label className="qv-control">
                    <span className="qv-label">Invitee email</span>
                    <input name="grantee_email" type="email" placeholder="future-admin@example.org" required />
                  </label>
                </div>
                <label className="qv-control">
                  <span className="qv-label">Onboarding notes</span>
                  <textarea name="grant_notes" placeholder="Optional handoff or takeover notes." rows={3} />
                </label>
                <div className="qv-form-actions">
                  <button type="submit" className="qv-link-button qv-button-secondary">Send admin invite</button>
                </div>
              </form>

              {pendingInvitations.length > 0 ? (
                <div className="qv-form-grid" style={{ marginTop: 20 }}>
                  <div>
                    <h3 className="qv-section-title" style={{ fontSize: 18 }}>Pending invites</h3>
                    <p className="qv-section-subtitle">These people have a secure sign-in link but have not accepted admin access yet.</p>
                  </div>
                  <div className="qv-member-list">
                    {pendingInvitations.map((invite) => (
                      <article key={invite.id} className="qv-member-row qv-member-row-compact">
                        <div className="qv-member-text">
                          <div className="qv-member-name qv-member-name-tight">{invite.invitee_name || invite.invitee_email}</div>
                          <div className="qv-member-meta qv-member-meta-tight">{invite.invitee_email}</div>
                          {invite.notes ? <div className="qv-member-meta qv-member-meta-tight">{invite.notes}</div> : null}
                          <div className="qv-member-meta qv-member-meta-tight">Expires {new Date(invite.expires_at).toLocaleDateString()}</div>
                        </div>
                        <div className="qv-member-row-right">
                          <ConfirmActionButton
                            triggerLabel="Revoke invite"
                            confirmTitle="Revoke admin invite?"
                            confirmDescription={`This will cancel the pending invite for ${invite.invitee_name || invite.invitee_email}.`}
                            confirmLabel="Revoke invite"
                            danger
                            action={revokeCouncilAdminInvitationAction}
                            hiddenFields={[{ name: 'invitation_id', value: invite.id }]}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="qv-empty">
              <p className="qv-empty-text">
                Only the current Grand Knight, Financial Secretary, or super admin can invite or remove manual admins.
              </p>
              {adminManagerAccess.roleLabels.length > 0 ? (
                <p className="qv-member-meta" style={{ marginTop: 8 }}>
                  Your current admin path: {adminManagerAccess.roleLabels.join(', ')}
                </p>
              ) : null}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
            {sortedAdmins.map((adminRow) => {
              const roleLabel = adminRow.automaticAdminLabels.length > 0
                ? `${adminRow.automaticAdminLabels.join(', ')} admin`
                : adminRow.currentOfficerLabels.length > 0
                  ? `${adminRow.currentOfficerLabels[0]} admin`
                  : 'Organization admin'

              const removeDescription = adminRow.automaticAdminLabels.length > 0
                ? `This removes the manual assignment for ${adminRow.label}, but their current officer role will still keep admin access active.`
                : `This will remove manual admin access for ${adminRow.label}.`

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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span className="qv-mini-pill">{adminRow.sourceBadge}</span>
                    {adminRow.automaticAdminLabels.length > 0 ? <span className="qv-mini-pill">Officer role</span> : null}
                  </div>
                  {adminRow.grantNotes ? (
                    <p className="qv-member-meta" style={{ margin: 0 }}>
                      {adminRow.grantNotes}
                    </p>
                  ) : null}
                  {adminManagerAccess.canManageAdmins && adminRow.assignmentId ? (
                    <ConfirmActionButton
                      triggerLabel="Remove admin"
                      confirmTitle="Remove admin access?"
                      confirmDescription={removeDescription}
                      confirmLabel="Remove admin"
                      danger
                      action={revokeCouncilAdminAction}
                      hiddenFields={[{ name: 'assignment_id', value: adminRow.assignmentId }]}
                    />
                  ) : null}
                </div>
              )
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
              <p className="qv-section-subtitle">Record service years and optionally grant manual admin access for the assigned officer.</p>
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
                <span className="qv-label">Grant manual admin access</span>
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
              const member = memberById.get(term.person_id)
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
                    confirmDescription={`This will end ${formatOfficerLabel(term)} for ${member ? memberName(member) : 'this member'}. The service history will stay on file.`}
                    confirmLabel="End term"
                    danger
                    action={removeOfficerTermAction}
                    hiddenFields={[{ name: 'term_id', value: term.id }]}
                  />
                </div>
              )
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
  )
}
