import AppHeader from '@/app/app-header'
import MembersList from '@/app/members-list'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'
import {
  summarizeCurrentOfficerLabels,
  summarizeExecutiveOfficerLabels,
  type OfficerTermRow,
} from '@/lib/members/officer-roles'
import { decryptPeopleRecords } from '@/lib/security/pii'

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  other_phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  primary_relationship_code: string
  council_activity_level_code: string | null
  council_activity_context_code: string | null
  council_reengagement_status_code: string | null
}

type OfficerTermWithPerson = OfficerTermRow & { person_id: string }

export default async function MembersPage() {
  const { admin: supabase, council } = await getCurrentActingCouncilContext({ redirectTo: '/me' })

  const { data: people, error } = await supabase
    .from('people')
    .select(
      'id, first_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
    )
    .eq('council_id', council.id)
    .is('archived_at', null)
    .is('merged_into_person_id', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .returns<PersonRow[]>()

  if (error) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <div className="qv-error">
            <strong>Could not load members.</strong>
            <p>{error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  const { data: organizationData } = council.organization_id
    ? await supabase
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
        .eq('id', council.organization_id)
        .maybeSingle()
    : { data: null }

  const organization = organizationData as {
    display_name: string | null
    preferred_name: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'

  const allPeople = decryptPeopleRecords(people ?? [])
  const members = allPeople.filter((person) => person.primary_relationship_code === 'member')
  const activeMembers = members.filter((person) => person.council_activity_level_code === 'active')
  const prospects = allPeople.filter((person) => person.primary_relationship_code === 'prospect')
  const volunteers = allPeople.filter((person) => person.primary_relationship_code === 'volunteer_only')

  const { data: officerTerms } = await supabase
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes')
    .eq('council_id', council.id)
    .returns<OfficerTermWithPerson[]>()

  const currentOfficerLabelsById = Object.fromEntries(
    [...new Set((officerTerms ?? []).map((term) => term.person_id))].map((personId) => [
      personId,
      summarizeCurrentOfficerLabels((officerTerms ?? []).filter((term) => term.person_id === personId)),
    ] as const)
  )

  const executiveOfficerLabelsById = Object.fromEntries(
    [...new Set((officerTerms ?? []).map((term) => term.person_id))].map((personId) => [
      personId,
      summarizeExecutiveOfficerLabels((officerTerms ?? []).filter((term) => term.person_id === personId)),
    ] as const)
  )

  const officerCount = Object.values(currentOfficerLabelsById).filter((labels) => labels.length > 0).length

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">
                {organizationName}
                {council.council_number ? ` (${council.council_number})` : ''}
              </p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Member directory</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Browse and manage members for your council.
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
          <div className="qv-stats">
            <div className="qv-stat-card">
              <div className="qv-stat-number">{members.length}</div>
              <div className="qv-stat-label">Members</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{activeMembers.length}</div>
              <div className="qv-stat-label">Active members</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{officerCount}</div>
              <div className="qv-stat-label">Current officers</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{volunteers.length + prospects.length}</div>
              <div className="qv-stat-label">Prospects + volunteers</div>
            </div>
          </div>
        </section>

        <SectionMenuBar
          items={[
            { label: 'Add member', href: '/members/new' },
            { label: 'Import Supreme list', href: '/imports/supreme' },
            { label: 'Archived members', href: '/members/archive' },
          ]}
        />

        <MembersList
          members={members}
          currentOfficerLabelsById={currentOfficerLabelsById}
          executiveOfficerLabelsById={executiveOfficerLabelsById}
        />
      </div>
    </main>
  )
}
