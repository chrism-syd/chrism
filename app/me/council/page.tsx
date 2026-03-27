import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import MemberSearchField from '@/app/components/member-search-field'
import OrganizationAvatar from '@/app/components/organization-avatar'
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
import AdminCarousel from './admin-carousel'
import OfficerCarousel from './officer-carousel'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
}

type MemberRow = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
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

export type AdminCarouselItem = {
  id: string
  assignmentId: string | null
  personId: string | null
  label: string
  roleLabel: string
  sourceBadge: string
  grantNotes: string | null
  removeDescription: string
}

export type OfficerCarouselItem = {
  id: string
  personId: string | null
  memberLabel: string
  officeLabel: string
  serviceLabel: string
  officeEmail: string
}

function memberName(member: MemberRow) {
  return member.preferred_name?.trim() || `${member.first_name} ${member.last_name}`.trim()
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
  if (normalized.some((label) => label.includes('grand knight'))) return 1
  if (normalized.some((label) => label.includes('financial secretary'))) return 2
  if (normalized.some((label) => label.includes('deputy grand knight'))) return 3
  return 100
}

function assignmentSourceLabel(sourceCode: AdminAssignmentRow['source_code']) {
  if (sourceCode === 'approved_claim') return 'Approved claim'
  if (sourceCode === 'admin_invitation') return 'Admin invite'
  return 'Manual assignment'
}

function getOrganizationName(organization: OrganizationRow | null, councilName: string | null) {
  return organization?.preferred_name?.trim() || organization?.display_name?.trim() || councilName || 'Organization'
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

  if (!permissions.organizationId) redirect('/me')

  const adminManagerAccess = await getOrganizationAdminManagerAccess({
    permissions,
    councilId: council.id,
  })

  if (!adminManagerAccess.canManageAdmins) redirect('/me')

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
      .select('id, first_name, last_name, preferred_name, email')
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
      .select('id, person_id, office_scope_code, office_code, office_rank, service_start_year, service_end_year, office_label')
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
      .select('id, display_name, preferred_name, logo_storage_path, logo_alt_text')
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
    if (!labels.includes(label)) currentOfficerLabelsByPersonId.set(term.person_id, [...labels, label])
  }

  const automaticAdminTerms = officerTerms.filter((term) => isAutomaticCouncilAdminTerm(term))
  const automaticAdminLabelsByPersonId = new Map<string, string[]>()
  for (const term of automaticAdminTerms) {
    const existing = automaticAdminLabelsByPersonId.get(term.person_id) ?? []
    const nextLabel = formatOfficerLabel(term)
    if (!existing.includes(nextLabel)) automaticAdminLabelsByPersonId.set(term.person_id, [...existing, nextLabel])
  }

  const currentAdmins = assignments.map((assignment) => {
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
        if (assignment.person_id === personId) return true
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
    .filter(Boolean)

  const sortedAdmins = [...currentAdmins, ...implicitAutomaticAdmins].sort((left, right) => {
    if (left.sortPriority !== right.sortPriority) return left.sortPriority - right.sortPriority
    return left.label.localeCompare(right.label)
  })

  const adminCards: AdminCarouselItem[] = sortedAdmins.map((adminRow) => {
    const roleLabel = adminRow.automaticAdminLabels.length > 0
      ? `${adminRow.automaticAdminLabels.join(', ')} admin`
      : adminRow.currentOfficerLabels.length > 0
        ? `${adminRow.currentOfficerLabels[0]} admin`
        : 'Organization admin'

    const removeDescription = adminRow.automaticAdminLabels.length > 0
      ? `This removes the manual assignment for ${adminRow.label}, but their current officer role will still keep admin access active.`
      : `This will remove admin access for ${adminRow.label}.`

    return {
      id: adminRow.id,
      assignmentId: adminRow.assignmentId,
      personId: adminRow.personId,
      label: adminRow.label,
      roleLabel,
      sourceBadge: adminRow.sourceBadge,
      grantNotes: adminRow.grantNotes,
      removeDescription,
    }
  })

  const fallbackMember: MemberRow = {
    id: '',
    first_name: 'Unknown',
    last_name: 'Member',
    preferred_name: null,
    email: null,
  }

  const sortedOfficerTerms = [...officerTerms].sort((left, right) => {
    const priorityDifference = officeSortPriority(left) - officeSortPriority(right)
    if (priorityDifference !== 0) return priorityDifference
    const leftName = memberName(memberById.get(left.person_id) ?? fallbackMember)
    const rightName = memberName(memberById.get(right.person_id) ?? fallbackMember)
    return leftName.localeCompare(rightName)
  })

  const officerCards: OfficerCarouselItem[] = sortedOfficerTerms.map((term) => {
    const member = memberById.get(term.person_id) ?? fallbackMember
    return {
      id: term.id,
      personId: member.id || null,
      memberLabel: memberName(member),
      officeLabel: formatOfficerLabel(term),
      serviceLabel: `${term.service_start_year}${term.service_end_year ? ` to ${term.service_end_year}` : ' to present'}`,
      officeEmail: officerRoleEmailByKey.get(`${term.office_scope_code}:${term.office_code}:${term.office_rank ?? 'none'}`) ?? '',
    }
  })

  const organizationName = getOrganizationName(organization, council.name)
  const eyebrow = `${organizationName}${council.council_number ? ` (${council.council_number})` : ''}`

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">{eyebrow}</p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Organization settings</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Manage identity, officers, and admin access.
              </p>
            </div>
            <div className="qv-org-avatar-wrap">
              <OrganizationAvatar
                displayName={organizationName}
                logoStoragePath={organization?.logo_storage_path ?? null}
                logoAltText={organization?.logo_alt_text ?? organizationName}
                size={72}
              />
            </div>
          </div>
        </section>

        <details style={{ marginTop: 18 }}>
          <summary
            className="qv-section-menu-shell"
            style={{
              listStyle: 'none',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 16,
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              <span className="qv-section-menu-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span>Add admin access</span>
                <span aria-hidden="true">▾</span>
              </span>
            </div>
          </summary>

          <section className="qv-card" style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(320px, 2fr) minmax(260px, 1fr)',
                gap: 20,
                alignItems: 'start',
              }}
            >
              <form action={grantCouncilAdminAction} className="qv-form-grid">
                <div>
                  <h2 className="qv-section-title" style={{ fontSize: 20 }}>Internal member lookup</h2>
                  <p className="qv-section-subtitle">Grant admin access to an existing member.</p>
                </div>
                <MemberSearchField
                  name="person_id"
                  label="Member"
                  members={memberOptions}
                  placeholder="Type a member name"
                  required
                />
                <label className="qv-control">
                  <span className="qv-label">Notes</span>
                  <textarea name="grant_notes" placeholder="Optional notes about why this member is being granted admin access." rows={5} />
                </label>
                <div className="qv-form-actions">
                  <button type="submit" className="qv-button-primary">Grant access</button>
                </div>
              </form>

              <form action={inviteCouncilAdminByEmailAction} className="qv-form-grid">
                <div>
                  <h2 className="qv-section-title" style={{ fontSize: 20 }}>External invite by email</h2>
                  <p className="qv-section-subtitle">Invite someone who is not already in the directory.</p>
                </div>
                <label className="qv-control">
                  <span className="qv-label">Invitee name</span>
                  <input name="invitee_name" placeholder="e.g. John Smith" />
                </label>
                <label className="qv-control">
                  <span className="qv-label">Invitee email</span>
                  <input name="grantee_email" type="email" placeholder="future-admin@example.org" required />
                </label>
                <label className="qv-control">
                  <span className="qv-label">Notes</span>
                  <textarea name="grant_notes" placeholder="Optional handoff or takeover notes." rows={5} />
                </label>
                <div className="qv-form-actions">
                  <button type="submit" className="qv-button-primary">Send invite</button>
                  <Link href="/me/council" className="qv-link-button">Cancel</Link>
                </div>
              </form>
            </div>

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
          </section>
        </details>

        {noticeMessage ? (
          <section className="qv-card" style={{ borderColor: 'var(--divider-strong)', marginTop: 18 }}>
            <p style={{ margin: 0, color: 'var(--text-primary)' }}>{noticeMessage}</p>
          </section>
        ) : null}

        {errorMessage ? (
          <section className="qv-card qv-error" style={{ marginTop: 18 }}>
            <p style={{ margin: 0 }}>{errorMessage}</p>
          </section>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 2fr) minmax(280px, 1fr)',
            gap: 16,
            marginTop: 20,
          }}
        >
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Council identity</h2>
                <p className="qv-section-subtitle">
                  Keep the formal organization name on file, and optionally set a shorter public name for day-to-day use.
                </p>
              </div>
            </div>

            <form action={updateCouncilDetailsAction} className="qv-form-grid">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
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

              <label className="qv-control">
                <span className="qv-label">Preferred public name</span>
                <input
                  name="preferred_name"
                  defaultValue={organization?.preferred_name ?? ''}
                  placeholder="Optional shorter name members will see"
                />
              </label>

              <div className="qv-form-actions">
                <button type="submit" className="qv-button-primary">Save organization details</button>
              </div>
            </form>
          </section>

          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Organization admins</h2>
                <p className="qv-section-subtitle">
                  Grand Knight and Financial Secretary admin access is automatic. Other admins are granted access.
                </p>
              </div>
            </div>

            <AdminCarousel items={adminCards} revokeAction={revokeCouncilAdminAction} />
          </section>
        </div>

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Officer assignments</h2>
              <p className="qv-section-subtitle">Record service years and official office email addresses.</p>
            </div>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary className="qv-link-button qv-button-secondary" style={{ listStyle: 'none', cursor: 'pointer', width: 'fit-content' }}>
              Add Officer Term
            </summary>

            <form action={addOfficerTermAction} className="qv-form-grid" style={{ marginTop: 18 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
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
                    <option value="" disabled>Choose a role</option>
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

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 16,
                }}
              >
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
          </details>

          <OfficerCarousel
            items={officerCards}
            saveOfficerRoleEmailAction={saveOfficerRoleEmailAction}
            removeOfficerTermAction={removeOfficerTermAction}
          />
        </section>
      </div>
    </main>
  )
}
