import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import DeleteMemberIconButton from '@/app/members/delete-member-icon-button'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { decryptPeopleRecord } from '@/lib/security/pii'
import { formatDate } from '@/lib/custom-lists'
import { summarizeCurrentOfficerLabels, summarizeExecutiveOfficerLabels, type OfficerTermRow } from '@/lib/members/officer-roles'

type PageProps = { params: Promise<{ id: string }> }

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
  primary_relationship_code: string | null
  council_id?: string | null
  nickname?: string | null
  council_activity_level_code: string | null
  council_activity_context_code: string | null
  council_reengagement_status_code: string | null
}

type MemberCustomListMembershipRow = {
  id: string
  custom_list_id: string
  claimed_by_person_id: string | null
  last_contact_at: string | null
  last_contact_by_person_id: string | null
}

type MemberCustomListRow = {
  id: string
  name: string
  description: string | null
}

function formatAddress(
  person: Pick<PersonRow, 'address_line_1' | 'address_line_2' | 'city' | 'state_province' | 'postal_code'>
) {
  const line1 = [person.address_line_1, person.address_line_2].filter(Boolean).join(', ')
  const line2 = [person.city, person.state_province, person.postal_code].filter(Boolean).join(', ')
  return [line1, line2].filter(Boolean).join(' • ')
}

function labelize(value: string | null) {
  return value ? value.replaceAll('_', ' ') : 'Not set'
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, council, permissions } = await getCurrentActingCouncilContext({ redirectTo: '/members' })

  const [{ data: memberScopedPersonData, error }, { data: officerTerms }, { data: customListMembershipsData }] = await Promise.all([
    supabase
      .from('people')
      .select(
        'id, first_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
      )
      .eq('id', id)
      .eq('council_id', council.id)
      .eq('primary_relationship_code', 'member')
      .is('archived_at', null)
      .maybeSingle<PersonRow>(),
    supabase
      .from('person_officer_terms')
      .select(
        'id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes'
      )
      .eq('person_id', id)
      .eq('council_id', council.id)
      .returns<OfficerTermRow[]>(),
    supabase
      .from('custom_list_members')
      .select('id, custom_list_id, claimed_by_person_id, last_contact_at, last_contact_by_person_id')
      .eq('person_id', id)
      .returns<MemberCustomListMembershipRow[]>(),
  ])

  if (error) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <section className="qv-hero-card">
            <p className="qv-eyebrow">Member Directory</p>
            <h1 className="qv-title">Member details</h1>
            <p className="qv-subtitle">Organization-facing contact and profile details.</p>
          </section>
          <div className="qv-error">
            <strong>Could not load member.</strong>
            <p>{error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  let externalAdminPersonData: PersonRow | null = null

  if (!memberScopedPersonData && permissions.canManageAdmins) {
    const { data: externalPersonData, error: externalPersonError } = await supabase
      .from('people')
      .select(
        'id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code, council_id'
      )
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle<PersonRow>()

    if (externalPersonError) {
      throw new Error(`Could not load external admin profile. ${externalPersonError.message}`)
    }

    if (externalPersonData) {
      const { data: orgAdminRow } = await supabase
        .from('organization_admin_assignments')
        .select('id')
        .eq('organization_id', permissions.organizationId)
        .eq('person_id', id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      const { data: councilAdminRow } = await supabase
        .from('council_admin_assignments')
        .select('id')
        .eq('council_id', council.id)
        .eq('person_id', id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (orgAdminRow || councilAdminRow) {
        externalAdminPersonData = externalPersonData
      }
    }
  }

  const personData = memberScopedPersonData ?? externalAdminPersonData
  const person = personData ? decryptPeopleRecord(personData) : null
  const isExternalAdminProfile = Boolean(externalAdminPersonData && !memberScopedPersonData)

  if (!person) {
    notFound()
  }

  const address = formatAddress(person)
  const currentOfficerLabels = summarizeCurrentOfficerLabels(officerTerms ?? [])
  const executiveOfficerLabels = summarizeExecutiveOfficerLabels(officerTerms ?? [])
  const officerSummary =
    executiveOfficerLabels.length > 0
      ? executiveOfficerLabels.join(', ')
      : currentOfficerLabels.length > 0
        ? currentOfficerLabels.join(', ')
        : null

  const customListMemberships = customListMembershipsData ?? []
  const customListIds = [...new Set(customListMemberships.map((membership) => membership.custom_list_id))]
  const relatedPeopleIds = [...new Set([
    ...customListMemberships.map((membership) => membership.last_contact_by_person_id).filter((value): value is string => Boolean(value)),
    ...customListMemberships.map((membership) => membership.claimed_by_person_id).filter((value): value is string => Boolean(value)),
  ])]

  const [customListsResult, relatedPeopleResult] = await Promise.all([
    customListIds.length > 0
      ? supabase
          .from('custom_lists')
          .select('id, name, description')
          .in('id', customListIds)
          .eq('council_id', council.id)
          .is('archived_at', null)
          .returns<MemberCustomListRow[]>()
      : Promise.resolve({ data: [] as MemberCustomListRow[] }),
    relatedPeopleIds.length > 0
      ? supabase
          .from('people')
          .select('id, first_name, last_name')
          .in('id', relatedPeopleIds)
          .returns<Array<{ id: string; first_name: string; last_name: string }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; last_name: string }> }),
  ])

  const customListsById = new Map((customListsResult.data ?? []).map((list) => [list.id, list]))
  const relatedPeopleById = new Map(
    (relatedPeopleResult.data ?? []).map((relatedPerson) => [relatedPerson.id, `${relatedPerson.first_name} ${relatedPerson.last_name}`.trim()])
  )

  const memberCustomLists = customListMemberships
    .map((membership) => ({
      membership,
      list: customListsById.get(membership.custom_list_id) ?? null,
      lastContactByName: membership.last_contact_by_person_id
        ? relatedPeopleById.get(membership.last_contact_by_person_id) ?? 'Unknown member'
        : null,
      claimedByName: membership.claimed_by_person_id
        ? relatedPeopleById.get(membership.claimed_by_person_id) ?? 'Unknown member'
        : null,
    }))
    .filter((item) => item.list)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-detail-hero-main">
            <div className="qv-detail-hero-copy">
              <p className="qv-eyebrow">Member Directory</p>
              <h1 className="qv-title">
                {person.first_name} {person.last_name}
              </h1>
              <p className="qv-subtitle">Organization-facing contact and profile details.</p>
              <div className="qv-detail-badges">
                <span className="qv-badge">{isExternalAdminProfile ? 'Admin contact' : 'Member'}</span>
                {person.council_activity_level_code ? (
                  <span className="qv-badge qv-badge-soft">{labelize(person.council_activity_level_code)}</span>
                ) : null}
                {officerSummary ? <span className="qv-badge qv-badge-soft">Officer</span> : null}
              </div>
            </div>
          </div>

          <div className="qv-detail-action-row" style={{ marginTop: 20 }}>
            <div className="qv-detail-actions">
              <Link href="/members" className="qv-button-secondary qv-link-button">
                Back to members
              </Link>
              {!isExternalAdminProfile ? (
                <Link href={`/members/${person.id}/edit`} className="qv-button-primary qv-link-button">
                  Edit member
                </Link>
              ) : null}
            </div>

            {permissions.isCouncilAdmin && !isExternalAdminProfile ? (
              <DeleteMemberIconButton
                memberId={person.id}
                memberName={`${person.first_name} ${person.last_name}`.trim()}
              />
            ) : null}
          </div>
        </section>

        <section className="qv-detail-grid">
          <div className="qv-detail-stack">
            <section className="qv-card">
              <h2 className="qv-section-title">Contact</h2>
              <p className="qv-section-subtitle">Current organization-facing contact details.</p>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Email</div>
                  <div className="qv-detail-value">{person.email || 'No email on file'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Cell phone</div>
                  <div className="qv-detail-value">{person.cell_phone || 'Not set'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Home phone</div>
                  <div className="qv-detail-value">{person.home_phone || 'Not set'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Other phone</div>
                  <div className="qv-detail-value">{person.other_phone || 'Not set'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Address</div>
                  <div className="qv-detail-value">{address || 'No address on file'}</div>
                </div>
              </div>
            </section>

          </div>

          <div className="qv-detail-stack">
            <section className="qv-card">
              <h2 className="qv-section-title">Organization profile</h2>
              <p className="qv-section-subtitle">Local organization-managed status fields.</p>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Relationship</div>
                  <div className="qv-detail-value">
                    {labelize(person.primary_relationship_code)}
                    {officerSummary ? (
                      <p className="qv-inline-message" style={{ marginTop: 6 }}>
                        Also serving as {officerSummary}.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Activity level</div>
                  <div className="qv-detail-value">{labelize(person.council_activity_level_code)}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Activity context</div>
                  <div className="qv-detail-value">{labelize(person.council_activity_context_code)}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Re-engagement status</div>
                  <div className="qv-detail-value">{labelize(person.council_reengagement_status_code)}</div>
                </div>
              </div>
            </section>

            {permissions.isCouncilAdmin && memberCustomLists.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Custom lists</h2>
                    <p className="qv-section-subtitle">This member appears on these lists. Open a list to see the full review and claiming screen.</p>
                  </div>
                  <Link href="/custom-lists" className="qv-button-secondary qv-link-button">
                    View lists
                  </Link>
                </div>

                <div className="qv-member-list-summary-stack" style={{ marginTop: 16 }}>
                  {memberCustomLists.map(({ membership, list, lastContactByName, claimedByName }) => (
                    <Link key={membership.id} href={`/custom-lists/${list!.id}`} className="qv-card qv-card-link qv-member-list-summary-card">
                      <div className="qv-list-row-head">
                        <div>
                          <h3 className="qv-list-row-title">{list!.name}</h3>
                          <p className="qv-inline-message" style={{ marginTop: 4 }}>
                            {list!.description || 'No description yet.'}
                          </p>
                          <div className="qv-detail-badges" style={{ marginTop: 10 }}>
                            {membership.claimed_by_person_id ? (
                              <span className="qv-badge qv-badge-soft">Claimed by {claimedByName || 'Unknown member'}</span>
                            ) : (
                              <span className="qv-badge qv-badge-soft">Unclaimed</span>
                            )}
                            {membership.last_contact_at ? (
                              <span className="qv-badge qv-badge-soft">Last contact {formatDate(membership.last_contact_at)}</span>
                            ) : (
                              <span className="qv-badge qv-badge-soft">No contact logged yet</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="qv-detail-list">
                        <div className="qv-detail-item">
                          <div className="qv-detail-label">Contacted by</div>
                          <div className="qv-detail-value">{lastContactByName || '—'}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
