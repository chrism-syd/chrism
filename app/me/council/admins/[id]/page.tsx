import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { listValidMemberPersonIdsForLocalUnit } from '@/lib/custom-lists'
import { decryptPeopleRecord } from '@/lib/security/pii'

type PageProps = {
  params: Promise<{ id: string }>
}

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
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
  council_id: string | null
}

type LinkedMemberRecordRow = {
  legacy_people_id: string | null
  preferred_display_name: string | null
  local_unit_id: string | null
  created_at: string
  local_unit?: {
    legacy_council_id: string | null
    local_unit_kind: string | null
  } | null
}

function formatAddress(
  person: Pick<PersonRow, 'address_line_1' | 'address_line_2' | 'city' | 'state_province' | 'postal_code'>
) {
  const line1 = [person.address_line_1, person.address_line_2].filter(Boolean).join(', ')
  const line2 = [person.city, person.state_province, person.postal_code].filter(Boolean).join(', ')
  return [line1, line2].filter(Boolean).join(' • ')
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function legalFullName(person: Pick<PersonRow, 'first_name' | 'last_name'>) {
  return `${person.first_name} ${person.last_name}`.trim()
}

function displayFullName(args: {
  person: Pick<PersonRow, 'first_name' | 'last_name' | 'nickname'>
  preferredDisplayName?: string | null
}) {
  const preferred = args.preferredDisplayName?.trim() || args.person.nickname?.trim() || null
  if (!preferred) return legalFullName(args.person)

  const legalLastName = args.person.last_name?.trim() ?? ''
  if (!legalLastName) return preferred
  if (normalize(preferred).endsWith(normalize(legalLastName))) return preferred

  return `${preferred} ${legalLastName}`.trim()
}

export default async function ExternalAdminProfilePage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, permissions, council, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'admins',
    minimumAccessLevel: 'manage',
  })

  if (!permissions.organizationId) redirect('/me')

  const validLocalUnitMemberIds =
    localUnitId
      ? await listValidMemberPersonIdsForLocalUnit({
          admin: supabase,
          localUnitId,
          personIds: [id],
        }).catch(() => [])
      : []

  const isScopedLocalMember = validLocalUnitMemberIds.includes(id)

  const [
    { data: personData, error: personError },
    { data: orgAdminRow },
    { data: councilAdminRow },
    { data: identityRow, error: identityError },
  ] = await Promise.all([
    supabase
      .from('people')
      .select(
        'id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_id'
      )
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle<PersonRow>(),
    supabase
      .from('organization_admin_assignments')
      .select('id')
      .eq('organization_id', permissions.organizationId)
      .eq('person_id', id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('council_admin_assignments')
      .select('id')
      .eq('council_id', council.id)
      .eq('person_id', id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('person_identity_links')
      .select('person_identity_id')
      .eq('person_id', id)
      .is('ended_at', null)
      .maybeSingle<{ person_identity_id: string }>(),
  ])

  if (personError) {
    throw new Error(`Could not load admin contact profile. ${personError.message}`)
  }

  if (identityError) {
    throw new Error(`Could not load linked identity context for this admin contact. ${identityError.message}`)
  }

  if (!personData || (!orgAdminRow && !councilAdminRow)) {
    notFound()
  }

  const person = decryptPeopleRecord(personData)

  if (isScopedLocalMember && person.primary_relationship_code === 'member') {
    redirect(`/members/${person.id}`)
  }

  const linkedPersonIds =
    identityRow?.person_identity_id
      ? (
          await supabase
            .from('person_identity_links')
            .select('person_id')
            .eq('person_identity_id', identityRow.person_identity_id)
            .is('ended_at', null)
        ).data?.map((row) => row.person_id).filter((value): value is string => Boolean(value)) ?? [id]
      : [id]

  const { data: linkedMemberRecordData, error: linkedMemberRecordError } =
    linkedPersonIds.length > 0
      ? await supabase
          .from('member_records')
          .select('legacy_people_id, preferred_display_name, local_unit_id, created_at, local_unit:local_unit_id(legacy_council_id, local_unit_kind)')
          .in('legacy_people_id', linkedPersonIds)
          .is('archived_at', null)
          .order('created_at', { ascending: true })
          .limit(50)
      : { data: [] as LinkedMemberRecordRow[], error: null }

  if (linkedMemberRecordError) {
    throw new Error(`Could not load linked member records for this admin contact. ${linkedMemberRecordError.message}`)
  }

  const linkedMemberRecords = (linkedMemberRecordData as LinkedMemberRecordRow[] | null) ?? []
  const preferredLinkedCouncilId =
    linkedMemberRecords.find((row) => row.local_unit?.local_unit_kind === 'council' && row.local_unit?.legacy_council_id)
      ?.local_unit?.legacy_council_id ??
    linkedMemberRecords.find((row) => row.local_unit?.legacy_council_id)?.local_unit?.legacy_council_id ??
    null

  const linkedCouncilIds = [
    ...new Set(
      linkedMemberRecords
        .map((row) => row.local_unit?.legacy_council_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]

  const { data: linkedCouncilData, error: linkedCouncilError } =
    linkedCouncilIds.length > 0
      ? await supabase
          .from('councils')
          .select('id, name, council_number')
          .in('id', linkedCouncilIds)
      : { data: [] as Array<{ id: string; name: string | null; council_number: string | null }>, error: null }

  if (linkedCouncilError) {
    throw new Error(`Could not load linked council details for this admin contact. ${linkedCouncilError.message}`)
  }

  const linkedCouncil = ((linkedCouncilData as Array<{ id: string; name: string | null; council_number: string | null }> | null) ?? []).find(
    (row) => row.id === preferredLinkedCouncilId
  )

  const preferredDisplayName =
    linkedMemberRecords.find((row) => row.legacy_people_id === id)?.preferred_display_name ??
    linkedMemberRecords.find((row) => Boolean(row.preferred_display_name))?.preferred_display_name ??
    null

  const address = formatAddress(person)
  const displayName = displayFullName({
    person,
    preferredDisplayName,
  })
  const legalName = legalFullName(person)
  const showLegalName = normalize(displayName) !== normalize(legalName)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-detail-hero-main">
            <div className="qv-detail-hero-copy">
              <p className="qv-eyebrow">Organization settings</p>
              <h1 className="qv-title">{displayName}</h1>
              <p className="qv-subtitle">Organization admin contact profile. This person has admin access without being treated as a local member record in this organization.</p>
              {showLegalName ? (
                <p className="qv-inline-message" style={{ marginTop: 10 }}>
                  {legalName}
                </p>
              ) : null}
              <div className="qv-detail-badges">
                <span className="qv-badge">Admin contact</span>
                {orgAdminRow ? <span className="qv-badge qv-badge-soft">Organization assignment</span> : null}
                {councilAdminRow ? <span className="qv-badge qv-badge-soft">Council assignment</span> : null}
              </div>
            </div>
          </div>

          <div className="qv-detail-action-row" style={{ marginTop: 20 }}>
            <div className="qv-detail-actions">
              <Link href="/me/council" className="qv-button-secondary qv-link-button">
                Back to organization settings
              </Link>
            </div>
          </div>
        </section>

        <section className="qv-detail-grid">
          <div className="qv-detail-stack">
            <section className="qv-card">
              <h2 className="qv-section-title">Contact</h2>
              <p className="qv-section-subtitle">Current contact information for this admin assignment.</p>

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
              <h2 className="qv-section-title">Admin access context</h2>
              <p className="qv-section-subtitle">This profile is for admin access visibility, not for treating the person as a local member.</p>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Local member record in this organization</div>
                  <div className="qv-detail-value">No</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Relationship in this view</div>
                  <div className="qv-detail-value">External admin contact</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Linked home council</div>
                  <div className="qv-detail-value">
                    {linkedCouncil
                      ? `${linkedCouncil.name ?? 'Council'}${linkedCouncil.council_number ? ` (${linkedCouncil.council_number})` : ''}`
                      : 'No linked council member record found'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
