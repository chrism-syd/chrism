import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import MembersList from '@/app/members-list'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { formatDateTime, listSharedCustomListIdsForUser, type CustomListRow } from '@/lib/custom-lists'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'
import {
  summarizeCurrentOfficerLabels,
  summarizeExecutiveOfficerLabels,
  type OfficerTermRow,
} from '@/lib/members/officer-roles'

type CountRow = {
  custom_list_id: string
}

type OrganizationRow = {
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
}

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

export default async function CustomListsPage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const sharedIds = await listSharedCustomListIdsForUser({ admin, permissions })

  let lists: CustomListRow[] = []
  let directoryMembers: PersonRow[] = []
  let currentOfficerLabelsById: Record<string, string[]> = {}
  let executiveOfficerLabelsById: Record<string, string[]> = {}

  if (permissions.isCouncilAdmin && permissions.councilId) {
    const [listsResult, peopleResult, officerTermsResult] = await Promise.all([
      admin
        .from('custom_lists')
        .select('id, council_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
        .eq('council_id', permissions.councilId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .returns<CustomListRow[]>(),
      admin
        .from('people')
        .select(
          'id, first_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
        )
        .eq('council_id', permissions.councilId)
        .is('archived_at', null)
        .is('merged_into_person_id', null)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .returns<PersonRow[]>(),
      admin
        .from('person_officer_terms')
        .select('id, person_id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes')
        .eq('council_id', permissions.councilId)
        .returns<OfficerTermWithPerson[]>(),
    ])

    lists = listsResult.data ?? []

    const people = decryptPeopleRecords(peopleResult.data ?? [])
    directoryMembers = people.filter((person) => person.primary_relationship_code === 'member')

    const officerTerms = officerTermsResult.data ?? []
    currentOfficerLabelsById = Object.fromEntries(
      [...new Set(officerTerms.map((term) => term.person_id))].map((personId) => [
        personId,
        summarizeCurrentOfficerLabels(officerTerms.filter((term) => term.person_id === personId)),
      ] as const)
    )

    executiveOfficerLabelsById = Object.fromEntries(
      [...new Set(officerTerms.map((term) => term.person_id))].map((personId) => [
        personId,
        summarizeExecutiveOfficerLabels(officerTerms.filter((term) => term.person_id === personId)),
      ] as const)
    )
  } else if (sharedIds.length > 0) {
    const { data } = await admin
      .from('custom_lists')
      .select('id, council_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
      .in('id', sharedIds)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .returns<CustomListRow[]>()

    lists = data ?? []
  }

  const organization = permissions.organizationId
    ? await admin
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
        .eq('id', permissions.organizationId)
        .maybeSingle<OrganizationRow>()
    : { data: null }

  const listIds = lists.map((list) => list.id)
  const [memberCountResult, accessCountResult] = await Promise.all([
    listIds.length > 0
      ? admin.from('custom_list_members').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    listIds.length > 0
      ? admin.from('custom_list_access').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
  ])

  const memberCounts = new Map<string, number>()
  for (const row of memberCountResult.data ?? []) {
    memberCounts.set(row.custom_list_id, (memberCounts.get(row.custom_list_id) ?? 0) + 1)
  }

  const accessCounts = new Map<string, number>()
  for (const row of accessCountResult.data ?? []) {
    accessCounts.set(row.custom_list_id, (accessCounts.get(row.custom_list_id) ?? 0) + 1)
  }

  const title = permissions.isCouncilAdmin && permissions.councilId ? 'Custom lists' : 'Shared custom lists'
  const subtitle =
    permissions.isCouncilAdmin && permissions.councilId
      ? 'Build named groups from your member directory, then share them with the people doing the follow-up.'
      : 'These are the custom lists that have been shared with you.'

  const organizationName = getEffectiveOrganizationName(organization.data ?? null)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">{organizationName ?? 'Custom lists'}</p>
              <h1 className="qv-title">{title}</h1>
              <p className="qv-subtitle">{subtitle}</p>
            </div>
            <div className="qv-org-avatar-wrap">
              <OrganizationAvatar
                displayName={organizationName ?? 'Organization'}
                logoStoragePath={organization.data?.logo_storage_path ?? null}
                logoAltText={organization.data?.logo_alt_text ?? organizationName ?? 'Organization'}
                size={72}
              />
            </div>
          </div>
        </section>

        {lists.length === 0 ? (
          <section className="qv-card" style={{ marginTop: 20 }}>
            <div className="qv-empty">
              <p className="qv-empty-title">
                {permissions.isCouncilAdmin ? 'No custom lists yet.' : 'No custom lists have been shared with you yet.'}
              </p>
              <p className="qv-empty-text">
                {permissions.isCouncilAdmin
                  ? 'Use the member list below to filter the members you want, then save that view as a custom list.'
                  : 'When a list is shared with you, it will appear here.'}
              </p>
            </div>
          </section>
        ) : (
          <section className="qv-card qv-compact-card" style={{ marginTop: 20 }}>
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Saved lists</h2>
                <p className="qv-section-subtitle">Open an existing list to review members, notes, and sharing.</p>
              </div>
            </div>

            <div className="qv-member-list">
              {lists.map((list) => (
                <Link key={list.id} href={`/custom-lists/${list.id}`} className="qv-member-link qv-card-link">
                  <article className="qv-member-row qv-custom-list-card">
                    <div className="qv-member-main">
                      <div className="qv-member-text">
                        <div className="qv-member-name">{list.name}</div>
                        <div className="qv-member-meta">{list.description || 'No description yet.'}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                          <span className="qv-member-meta">Members: {memberCounts.get(list.id) ?? 0}</span>
                          <span className="qv-member-meta">Shared with: {accessCounts.get(list.id) ?? 0}</span>
                          <span className="qv-member-meta">Last updated: {formatDateTime(list.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="qv-member-row-right">
                      <span className="qv-chevron">›</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}

        {permissions.isCouncilAdmin ? (
          <section className="qv-card" style={{ marginTop: 20 }}>
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Create from member directory</h2>
                <p className="qv-section-subtitle">
                  Filter the members you want, then save the current view as a custom list.
                </p>
              </div>
              <Link href="/members" className="qv-link-button qv-button-secondary">
                Member directory
              </Link>
            </div>

            <MembersList
              members={directoryMembers}
              currentOfficerLabelsById={currentOfficerLabelsById}
              executiveOfficerLabelsById={executiveOfficerLabelsById}
            />
          </section>
        ) : null}
      </div>
    </main>
  )
}
