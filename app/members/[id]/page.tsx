import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import DeleteMemberIconButton from '@/app/members/delete-member-icon-button'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { decryptPeopleRecord } from '@/lib/security/pii'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { formatDate } from '@/lib/custom-lists'
import { summarizeCurrentOfficerLabels, summarizeExecutiveOfficerLabels, type OfficerTermRow } from '@/lib/members/officer-roles'

type PageProps = { params: Promise<{ id: string }> }

type PersonRow = {
  id: string
  first_name: string
  middle_name: string | null
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

function startCase(value: string | null) {
  if (!value) return null
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatFullName(person: Pick<PersonRow, 'first_name' | 'middle_name' | 'last_name'>) {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, council, permissions } = await getCurrentActingCouncilContext({
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  const { data: organizationData } = council.organization_id
    ? await supabase
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
        .eq('id', council.organization_id)
        .maybeSingle()
    : { data: null }

  const organization = organizationData as {
    display_name: string | null
    preferred_name: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
    brand_profile?: {
      code: string | null
      display_name: string | null
      logo_storage_bucket: string | null
      logo_storage_path: string | null
      logo_alt_text: string | null
    } | null
  } | null

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  const [{ data: memberScopedPersonData, error }, { data: officerTerms }, { data: customListMembershipsData }] =
    await Promise.all([
      supabase
        .from('people')
        .select(
          'id, first_name, middle_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
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

          <section style={{ display: 'grid', gap: 14, marginTop: 12, marginBottom: 18 }}>
            <h1
              className="qv-directory-name"
              style={{
                margin: 0,
                fontSize: 'clamp(42px, 6.4vw, 68px)',
                lineHeight: 0.96,
                letterSpacing: '-0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              Member Detail
            </h1>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
              Review local organization contact, status, and custom list details.
            </p>
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
        'id, first_name, middle_name, last_name, nickname, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code, council_id'
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

  const memberName = formatFullName(person)
  const address = formatAddress(person)
  const currentOfficerLabels = summarizeCurrentOfficerLabels(officerTerms ?? [])
  const executiveOfficerLabels = summarizeExecutiveOfficerLabels(officerTerms ?? [])
  const officerSummary =
    executiveOfficerLabels.length > 0
      ? executiveOfficerLabels.join(', ')
      : currentOfficerLabels.length > 0
        ? currentOfficerLabels.join(', ')
        : null

  const relationshipLabel = isExternalAdminProfile ? 'Admin Contact' : startCase(person.primary_relationship_code) ?? 'Member'
  const activityLevelLabel = startCase(person.council_activity_level_code)
  const activityContextLabel = startCase(person.council_activity_context_code)
  const reengagementLabel = startCase(person.council_reengagement_status_code)

  const rightDetailRows = [
    activityContextLabel ? { label: 'Activity context', value: activityContextLabel } : null,
    reengagementLabel ? { label: 'Re-engagement status', value: reengagementLabel } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row))

  const customListMemberships = customListMembershipsData ?? []
  const customListIds = [...new Set(customListMemberships.map((membership) => membership.custom_list_id))]
  const relatedPeopleIds = [
    ...new Set([
      ...customListMemberships
        .map((membership) => membership.last_contact_by_person_id)
        .filter((value): value is string => Boolean(value)),
      ...customListMemberships
        .map((membership) => membership.claimed_by_person_id)
        .filter((value): value is string => Boolean(value)),
    ]),
  ]

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
    (relatedPeopleResult.data ?? []).map((relatedPerson) => [
      relatedPerson.id,
      `${relatedPerson.first_name} ${relatedPerson.last_name}`.trim(),
    ])
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

  const customListGridColumns =
    memberCustomLists.length >= 3
      ? 'repeat(3, minmax(0, 1fr))'
      : memberCustomLists.length === 2
        ? 'repeat(2, minmax(0, 1fr))'
        : 'minmax(0, 1fr)'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section style={{ display: 'grid', gap: 14, marginTop: 12, marginBottom: 18 }}>
          <h1
            className="qv-directory-name"
            style={{
              margin: 0,
              fontSize: 'clamp(42px, 6.4vw, 68px)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Member Detail
          </h1>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
            Review local organization contact, status, and custom list details.
          </p>
        </section>

        <section>
          <div className="qv-hero-card" style={{ paddingBottom: 16 }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 24,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'grid', gap: 18, flex: '1 1 560px', minWidth: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Link
                      href="/members"
                      aria-label="Back to members"
                      className="qv-link-button"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: '1px solid var(--divider-strong)',
                        background: 'var(--bg-card)',
                        color: 'var(--interactive)',
                        fontSize: 18,
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      ‹
                    </Link>
                    <p className="qv-eyebrow" style={{ margin: 0 }}>
                      Member Directory
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-heading), Georgia, serif',
                        fontSize: 'clamp(42px, 6vw, 58px)',
                        lineHeight: 0.98,
                        letterSpacing: '-0.035em',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {memberName}
                    </h2>

                    <div className="qv-detail-badges" style={{ marginTop: 0 }}>
                      <span className="qv-badge">{relationshipLabel}</span>
                      {activityLevelLabel ? <span className="qv-badge qv-badge-soft">{activityLevelLabel}</span> : null}
                      {officerSummary ? <span className="qv-badge qv-badge-soft">{officerSummary}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="qv-org-avatar-wrap">
                  <OrganizationAvatar
                    displayName={organizationName}
                    logoStoragePath={effectiveBranding.logo_storage_path}
                    logoAltText={effectiveBranding.logo_alt_text ?? organizationName}
                    size={72}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.55fr) minmax(260px, 0.95fr)',
                  gap: 36,
                  alignItems: 'start',
                }}
              >
                <div className="qv-detail-list" style={{ marginTop: 0 }}>
                  <div className="qv-detail-item" style={{ paddingTop: 0 }}>
                    <div className="qv-detail-label">Email</div>
                    <div className="qv-detail-value">{person.email || 'No email on file'}</div>
                  </div>

                  <div className="qv-detail-item">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 24,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="qv-detail-label">Cell phone</div>
                        <div className="qv-detail-value">{person.cell_phone || 'Not set'}</div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="qv-detail-label">Home phone</div>
                        <div className="qv-detail-value">{person.home_phone || 'Not set'}</div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="qv-detail-label">Other phone</div>
                        <div className="qv-detail-value">{person.other_phone || 'Not set'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Address</div>
                    <div className="qv-detail-value">{address || 'No address on file'}</div>
                  </div>
                </div>

                <div className="qv-detail-list" style={{ marginTop: 0 }}>
                  {rightDetailRows.map((row, index) => (
                    <div
                      key={row.label}
                      className="qv-detail-item"
                      style={index === 0 ? { paddingTop: 0 } : undefined}
                    >
                      <div className="qv-detail-label">{row.label}</div>
                      <div className="qv-detail-value">{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="qv-section-menu-shell" style={{ marginTop: -22 }}>
            <div
              style={{
                position: 'relative',
                minHeight: 58,
                paddingInline: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!isExternalAdminProfile ? (
                <Link href={`/members/${person.id}/edit`} className="qv-button-secondary qv-link-button">
                  Edit member
                </Link>
              ) : null}

              {permissions.isCouncilAdmin && !isExternalAdminProfile ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 28,
                    top: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <DeleteMemberIconButton memberId={person.id} memberName={memberName} />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {permissions.isCouncilAdmin && memberCustomLists.length > 0 ? (
          <section className="qv-card">
            <div>
              <h2 className="qv-section-title">{person.first_name} appears on these lists</h2>
            </div>

            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: customListGridColumns,
                gap: 16,
                alignItems: 'start',
              }}
            >
              {memberCustomLists.map(({ membership, list, lastContactByName, claimedByName }) => (
                <Link
                  key={membership.id}
                  href={`/custom-lists/${list!.id}`}
                  className="qv-card qv-card-link qv-member-list-summary-card"
                >
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
    </main>
  )
}
