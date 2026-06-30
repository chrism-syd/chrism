import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import DeleteMemberIconButton from '@/app/members/delete-member-icon-button'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { formatDate, listValidDirectoryPersonIdsForLocalUnit } from '@/lib/custom-lists'
import { getKnightsOfColumbusFraternalYearForDate, isOfficerTermActive, summarizeCurrentOfficerLabels, summarizeExecutiveOfficerLabels, summarizeLastingHonorifics, type OfficerTermRow } from '@/lib/members/officer-roles'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { decryptPeopleRecord } from '@/lib/security/pii'

type PageProps = { params: Promise<{ id: string }> }
type PersonRow = { id: string; first_name: string; middle_name: string | null; last_name: string; email: string | null; cell_phone: string | null; home_phone: string | null; other_phone: string | null; address_line_1: string | null; address_line_2: string | null; city: string | null; state_province: string | null; postal_code: string | null; primary_relationship_code: string | null; council_activity_level_code: string | null; council_activity_context_code: string | null; council_reengagement_status_code: string | null }
type MemberCustomListMembershipRow = { id: string; custom_list_id: string; claimed_by_person_id: string | null; last_contact_at: string | null; last_contact_by_person_id: string | null }
type MemberCustomListRow = { id: string; local_unit_id: string | null; name: string; description: string | null }
type OrganizationRow = { display_name: string | null; preferred_name: string | null; logo_storage_path: string | null; logo_alt_text: string | null; org_type_code: string | null; brand_profile?: { code: string | null; display_name: string | null; logo_storage_bucket: string | null; logo_storage_path: string | null; logo_alt_text: string | null } | null }
type ReportingYearSettingsRow = { year_label: string; year_start_month: number; year_start_day: number }
type VolunteerContributionEntryRow = { source_type: 'event' | 'manual_adjustment'; source_id: string; event_id: string | null; event_title: string | null; credited_on: string; hours: number | string; note: string | null }

function formatAddress(person: Pick<PersonRow, 'address_line_1' | 'address_line_2' | 'city' | 'state_province' | 'postal_code'>) {
  const line1 = [person.address_line_1, person.address_line_2].filter(Boolean).join(', ')
  const line2 = [person.city, person.state_province, person.postal_code].filter(Boolean).join(' • ')
  return [line1, line2].filter(Boolean).join(' • ')
}
function startCase(value: string | null) { if (!value) return null; return value.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ') }
function formatFullName(person: Pick<PersonRow, 'first_name' | 'middle_name' | 'last_name'>) { return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ') }
function normalize(value?: string | null) { return (value ?? '').trim().toLowerCase() }
function formatDisplayName(args: { firstName: string; lastName: string; preferredDisplayName?: string | null }) {
  const preferred = args.preferredDisplayName?.trim()
  if (!preferred) return `${args.firstName} ${args.lastName}`.trim()
  if (normalize(preferred).endsWith(normalize(args.lastName))) return preferred
  return `${preferred} ${args.lastName}`.trim()
}
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
function formatHours(value: number) {
  const rounded = Math.round(value * 100) / 100
  return rounded.toLocaleString('en-CA', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}
function formatShortDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}
function getDefaultReportingYearSettings(orgTypeCode?: string | null): ReportingYearSettingsRow {
  if (orgTypeCode === 'knights_of_columbus') {
    return { year_label: 'Fraternal year', year_start_month: 7, year_start_day: 1 }
  }
  return { year_label: 'Calendar year', year_start_month: 1, year_start_day: 1 }
}
function buildReportingYearRange(settings: ReportingYearSettingsRow, today = new Date()) {
  const currentYear = today.getFullYear()
  const startThisYear = new Date(Date.UTC(currentYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const startYear = today.getTime() >= startThisYear.getTime() ? currentYear : currentYear - 1
  const start = new Date(Date.UTC(startYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const end = new Date(Date.UTC(startYear + 1, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: `${settings.year_label} ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}
function isWithinRange(date: string, startDate: string, endDate: string) { return date >= startDate && date < endDate }

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, council, permissions, localUnitId } = await getCurrentActingCouncilContext({ redirectTo: '/members', areaCode: 'members', minimumAccessLevel: 'edit_manage' })
  if (!localUnitId) notFound()

  const validLocalUnitPersonIds = await listValidDirectoryPersonIdsForLocalUnit({ admin: supabase, localUnitId, personIds: [id] }).catch((): string[] => [])
  const isScopedPerson = validLocalUnitPersonIds.includes(id)

  const { data: activeOrgAdminAssignment, error: activeOrgAdminAssignmentError } = permissions.organizationId
    ? await supabase
        .from('organization_admin_assignments')
        .select('id')
        .eq('organization_id', permissions.organizationId)
        .eq('person_id', id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle<{ id: string }>()
    : { data: null, error: null }

  if (activeOrgAdminAssignmentError) {
    throw new Error(`Could not verify organization admin scope for this person. ${activeOrgAdminAssignmentError.message}`)
  }

  if (activeOrgAdminAssignment?.id) {
    const { data: visibleDirectoryPerson } = await supabase
      .from('member_records')
      .select('id')
      .eq('local_unit_id', localUnitId)
      .eq('legacy_people_id', id)
      .is('archived_at', null)
      .maybeSingle<{ id: string }>()

    if (!visibleDirectoryPerson) {
      redirect(`/me/council/admins/${id}`)
    }
  }

  if (!isScopedPerson) {
    notFound()
  }

  const { data: organizationData } = council.organization_id ? await supabase.from('organizations').select('display_name, preferred_name, logo_storage_path, logo_alt_text, org_type_code, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)').eq('id', council.organization_id).maybeSingle<OrganizationRow>() : { data: null }

  const organization = (organizationData as OrganizationRow | null) ?? null
  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  const scopedPersonPromise = supabase.from('people').select('id, first_name, middle_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code').eq('id', id).is('archived_at', null).maybeSingle<PersonRow>()

  const [{ data: scopedPersonData, error }, { data: officerTerms }, { data: customListMembershipsData }, { data: memberRecordData, error: memberRecordError }] = await Promise.all([
    scopedPersonPromise,
    supabase.from('person_officer_terms').select('id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, manual_end_effective_date, notes').eq('person_id', id).eq('local_unit_id', localUnitId).returns<OfficerTermRow[]>(),
    supabase.from('custom_list_members').select('id, custom_list_id, claimed_by_person_id, last_contact_at, last_contact_by_person_id').eq('person_id', id).returns<MemberCustomListMembershipRow[]>(),
    supabase.from('member_records').select('preferred_display_name').eq('local_unit_id', localUnitId).eq('legacy_people_id', id).is('archived_at', null).maybeSingle<{ preferred_display_name: string | null }>(),
  ])

  if (error) return <main className="qv-page"><div className="qv-shell"><AppHeader /><section style={{ display: 'grid', gap: 14, marginTop: 12, marginBottom: 18 }}><h1 className="qv-directory-name" style={{ margin: 0, fontSize: 'clamp(42px, 6.4vw, 68px)', lineHeight: 0.96, letterSpacing: '-0.04em', whiteSpace: 'nowrap' }}>Person Detail</h1><p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>Review local organization contact, status, and custom list details.</p></section><div className="qv-error"><strong>Could not load person.</strong><p>{error.message}</p></div></div></main>
  if (memberRecordError) throw new Error(`Could not load the local-org member record. ${memberRecordError.message}`)

  const person = scopedPersonData ? decryptPeopleRecord(scopedPersonData) : null
  if (!person) notFound()

  const legalName = formatFullName(person)
  const preferredDisplayName = memberRecordData?.preferred_display_name ?? null
  const personName = formatDisplayName({ firstName: person.first_name, lastName: person.last_name, preferredDisplayName })
  const showLegalName = normalize(personName) !== normalize(legalName)
  const address = formatAddress(person)
  const currentFraternalYear = getKnightsOfColumbusFraternalYearForDate()
  const activeOfficerTerms = (officerTerms ?? []).filter((term) => isOfficerTermActive(term, { useKnightsOfColumbusFraternalYear: true }))
  const currentOfficerLabels = summarizeCurrentOfficerLabels(activeOfficerTerms, currentFraternalYear)
  const executiveOfficerLabels = summarizeExecutiveOfficerLabels(activeOfficerTerms, currentFraternalYear)
  const lastingHonorificLabels = summarizeLastingHonorifics(officerTerms ?? [], { useKnightsOfColumbusFraternalYear: true })
  const officerSummary = executiveOfficerLabels.length > 0 ? executiveOfficerLabels.join(', ') : currentOfficerLabels.length > 0 ? currentOfficerLabels.join(', ') : null
  const relationshipLabel = person.primary_relationship_code === 'volunteer_only' ? 'Volunteer' : startCase(person.primary_relationship_code) ?? 'Person'
  const activityLevelLabel = startCase(person.council_activity_level_code)
  const activityContextLabel = startCase(person.council_activity_context_code)
  const reengagementLabel = startCase(person.council_reengagement_status_code)
  const rightDetailRows = [activityContextLabel ? { label: 'Activity context', value: activityContextLabel } : null, reengagementLabel ? { label: 'Re-engagement status', value: reengagementLabel } : null].filter((row): row is { label: string; value: string } => Boolean(row))
  const customListMemberships = customListMembershipsData ?? []
  const customListIds = [...new Set(customListMemberships.map((membership) => membership.custom_list_id))]
  const relatedPeopleIds = [...new Set([...customListMemberships.map((membership) => membership.last_contact_by_person_id).filter((value): value is string => Boolean(value)), ...customListMemberships.map((membership) => membership.claimed_by_person_id).filter((value): value is string => Boolean(value))])]

  const [customListsResult, relatedPeopleResult, volunteerEntriesResult, reportingYearSettingsResult] = await Promise.all([
    customListIds.length > 0 ? supabase.from('custom_lists').select('id, local_unit_id, name, description').in('id', customListIds).eq('local_unit_id', localUnitId).is('archived_at', null).returns<MemberCustomListRow[]>() : Promise.resolve({ data: [] as MemberCustomListRow[] }),
    relatedPeopleIds.length > 0 ? supabase.from('people').select('id, first_name, last_name').in('id', relatedPeopleIds).returns<Array<{ id: string; first_name: string; last_name: string }>>() : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; last_name: string }> }),
    supabase.from('local_unit_volunteer_contribution_entries').select('source_type, source_id, event_id, event_title, credited_on, hours, note').eq('local_unit_id', localUnitId).eq('person_id', id).order('credited_on', { ascending: false }).limit(12).returns<VolunteerContributionEntryRow[]>(),
    supabase.from('local_unit_reporting_year_settings').select('year_label, year_start_month, year_start_day').eq('local_unit_id', localUnitId).maybeSingle<ReportingYearSettingsRow>(),
  ])

  const customListsById = new Map((customListsResult.data ?? []).map((list) => [list.id, list]))
  const relatedPeopleById = new Map((relatedPeopleResult.data ?? []).map((relatedPerson) => [relatedPerson.id, `${relatedPerson.first_name} ${relatedPerson.last_name}`.trim()]))
  const memberCustomLists = customListMemberships.map((membership) => ({ membership, list: customListsById.get(membership.custom_list_id) ?? null, lastContactByName: membership.last_contact_by_person_id ? relatedPeopleById.get(membership.last_contact_by_person_id) ?? 'Unknown person' : null, claimedByName: membership.claimed_by_person_id ? relatedPeopleById.get(membership.claimed_by_person_id) ?? 'Unknown person' : null })).filter((item) => item.list)
  const customListGridColumns = memberCustomLists.length >= 3 ? 'repeat(3, minmax(0, 1fr))' : memberCustomLists.length === 2 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'
  const defaultReportingYearSettings = getDefaultReportingYearSettings(organization?.org_type_code)
  const reportingYearSettings = reportingYearSettingsResult.data ?? defaultReportingYearSettings
  const reportingYear = buildReportingYearRange(reportingYearSettings)
  const volunteerEntries = volunteerEntriesResult.error ? [] : volunteerEntriesResult.data ?? []
  const currentVolunteerEntries = volunteerEntries.filter((entry) => isWithinRange(entry.credited_on, reportingYear.startDate, reportingYear.endDate))
  const currentEventEntries = currentVolunteerEntries.filter((entry) => entry.source_type === 'event')
  const currentVolunteerEventCount = new Set(currentEventEntries.map((entry) => entry.event_id).filter(Boolean)).size
  const currentVolunteerHours = currentVolunteerEntries.reduce((total, entry) => total + toNumber(entry.hours), 0)
  const allTimeVolunteerHours = volunteerEntries.reduce((total, entry) => total + toNumber(entry.hours), 0)
  const allTimeVolunteerEventCount = new Set(volunteerEntries.filter((entry) => entry.source_type === 'event').map((entry) => entry.event_id).filter(Boolean)).size
  const recentVolunteerEntries = volunteerEntries.slice(0, 5)

  return <main className="qv-page"><div className="qv-shell"><AppHeader />
    <section style={{ display: 'grid', gap: 14, marginTop: 12, marginBottom: 18 }}>
      <h1 className="qv-directory-name" style={{ margin: 0, fontSize: 'clamp(42px, 6.4vw, 68px)', lineHeight: 0.96, letterSpacing: '-0.04em', whiteSpace: 'nowrap' }}>Person Detail</h1>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>Review local organization contact, status, and custom list details.</p>
    </section>

    <section>
      <div className="qv-hero-card" style={{ paddingBottom: 16 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 18, flex: '1 1 560px', minWidth: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Link href="/members" aria-label="Back to people" className="qv-link-button" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--divider-strong)', background: 'var(--bg-card)', color: 'var(--interactive)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>‹</Link>
                <p className="qv-eyebrow" style={{ margin: 0 }}>People Directory</p>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading), Georgia, serif', fontSize: 'clamp(42px, 6vw, 58px)', lineHeight: 0.98, letterSpacing: '-0.035em', color: 'var(--text-primary)' }}>{personName}</h2>
                {showLegalName ? <p className="qv-inline-message" style={{ margin: 0, fontSize: 16 }}>{legalName}</p> : null}
                <div className="qv-detail-badges" style={{ marginTop: 0 }}>
                  <span className="qv-badge">{relationshipLabel}</span>
                  {activityLevelLabel ? <span className="qv-badge qv-badge-soft">{activityLevelLabel}</span> : null}
                  {officerSummary ? <span className="qv-badge qv-badge-soft">{officerSummary}</span> : null}
                  {lastingHonorificLabels.map((label) => <span key={label} className="qv-badge qv-badge-soft">{label}</span>)}
                </div>
              </div>
            </div>
            <div className="qv-org-avatar-wrap"><OrganizationAvatar displayName={organizationName} logoStoragePath={effectiveBranding.logo_storage_path} logoAltText={effectiveBranding.logo_alt_text ?? organizationName} size={72} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(260px, 0.95fr)', gap: 36, alignItems: 'start' }}>
            <div className="qv-detail-list" style={{ marginTop: 0 }}>
              <div className="qv-detail-item" style={{ paddingTop: 0 }}><div className="qv-detail-label">Email</div><div className="qv-detail-value">{person.email || 'No email on file'}</div></div>
              <div className="qv-detail-item"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 24 }}><div style={{ minWidth: 0 }}><div className="qv-detail-label">Cell phone</div><div className="qv-detail-value">{person.cell_phone || 'Not set'}</div></div><div style={{ minWidth: 0 }}><div className="qv-detail-label">Home phone</div><div className="qv-detail-value">{person.home_phone || 'Not set'}</div></div><div style={{ minWidth: 0 }}><div className="qv-detail-label">Other phone</div><div className="qv-detail-value">{person.other_phone || 'Not set'}</div></div></div></div>
              <div className="qv-detail-item"><div className="qv-detail-label">Address</div><div className="qv-detail-value">{address || 'No address on file'}</div></div>
            </div>
            <div className="qv-detail-list" style={{ marginTop: 0 }}>{rightDetailRows.map((row, index) => <div key={row.label} className="qv-detail-item" style={index === 0 ? { paddingTop: 0 } : undefined}><div className="qv-detail-label">{row.label}</div><div className="qv-detail-value">{row.value}</div></div>)}</div>
          </div>
        </div>
      </div>

      <div className="qv-section-menu-shell" style={{ marginTop: -22 }}>
        <div style={{ position: 'relative', minHeight: 58, paddingInline: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Link href={`/members/${person.id}/edit`} className="qv-button-secondary qv-link-button">Edit person</Link>
          {permissions.isCouncilAdmin ? <div style={{ position: 'absolute', right: 28, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}><DeleteMemberIconButton memberId={person.id} memberName={personName} /></div> : null}
        </div>
      </div>
    </section>

    <section className="qv-card">
      <div className="qv-directory-section-head">
        <div>
          <h2 className="qv-section-title">Volunteer contribution</h2>
          <p className="qv-section-subtitle">Completed-event hours plus active manual adjustments for this local organization.</p>
        </div>
        <Link href="/events/volunteer-hours" className="qv-button-secondary qv-link-button">Audit all hours</Link>
      </div>
      {volunteerEntriesResult.error ? <div className="qv-error" style={{ marginTop: 16 }}>Could not load volunteer contribution data.</div> : <>
        <div className="qv-stats" style={{ marginTop: 16 }}>
          <div className="qv-stat-card"><div className="qv-stat-number">{formatHours(currentVolunteerHours)}</div><div className="qv-stat-label">Hours in {reportingYear.label}</div></div>
          <div className="qv-stat-card"><div className="qv-stat-number">{currentVolunteerEventCount}</div><div className="qv-stat-label">Volunteer events this year</div></div>
          <div className="qv-stat-card"><div className="qv-stat-number">{formatHours(allTimeVolunteerHours)}</div><div className="qv-stat-label">All-time hours</div></div>
          <div className="qv-stat-card"><div className="qv-stat-number">{allTimeVolunteerEventCount}</div><div className="qv-stat-label">All-time volunteer events</div></div>
        </div>
        {recentVolunteerEntries.length > 0 ? <div className="qv-detail-list" style={{ marginTop: 18 }}>
          {recentVolunteerEntries.map((entry) => <div key={entry.source_id} className="qv-detail-item">
            <div className="qv-detail-label">{entry.source_type === 'event' ? 'Completed event' : 'Manual adjustment'} · {formatShortDate(entry.credited_on)}</div>
            <div className="qv-detail-value">{entry.event_title ?? 'Manual adjustment'} · {formatHours(toNumber(entry.hours))}h</div>
            {entry.note ? <div className="qv-member-meta">{entry.note}</div> : null}
          </div>)}
        </div> : <div className="qv-empty" style={{ marginTop: 16 }}><h3 className="qv-empty-title">No volunteer hours yet</h3><p className="qv-empty-text">Hours will appear after this person is marked as a volunteer on completed events, or after an adjustment is added.</p></div>}
      </>}
    </section>

    {permissions.isCouncilAdmin && memberCustomLists.length > 0 ? <section className="qv-card"><div><h2 className="qv-section-title">{personName} appears on these lists</h2></div><div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: customListGridColumns, gap: 16, alignItems: 'start' }}>{memberCustomLists.map(({ membership, list, lastContactByName, claimedByName }) => <Link key={membership.id} href={`/custom-lists/${list!.id}`} className="qv-card qv-card-link qv-member-list-summary-card"><div className="qv-list-row-head"><div><h3 className="qv-list-row-title">{list!.name}</h3><p className="qv-inline-message" style={{ marginTop: 4 }}>{list!.description || 'No description yet.'}</p><div className="qv-detail-badges" style={{ marginTop: 10 }}>{membership.claimed_by_person_id ? <span className="qv-badge qv-badge-soft">Claimed by {claimedByName || 'Unknown person'}</span> : <span className="qv-badge qv-badge-soft">Unclaimed</span>}{membership.last_contact_at ? <span className="qv-badge qv-badge-soft">Last contact {formatDate(membership.last_contact_at)}</span> : <span className="qv-badge qv-badge-soft">No contact logged yet</span>}</div></div></div><div className="qv-detail-list"><div className="qv-detail-item"><div className="qv-detail-label">Contacted by</div><div className="qv-detail-value">{lastContactByName || '—'}</div></div></div></Link>)}</div></section> : null}
  </div></main>
}
