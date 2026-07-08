import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { listValidDirectoryPeopleForLocalUnit } from '@/lib/custom-lists'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { addVolunteerHourAdjustment, voidVolunteerHourAdjustment } from './actions'

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  preferred_display_name: string | null
  email: string | null
}

type OrganizationRow = {
  display_name: string | null
  preferred_name: string | null
  org_type_code: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}

type ReportingYearSettingsRow = {
  year_label: string
  year_start_month: number
  year_start_day: number
}

type ContributionEntryRow = {
  source_type: 'event' | 'manual_adjustment'
  source_id: string
  local_unit_id: string
  person_id: string
  event_id: string | null
  event_title: string | null
  credited_on: string
  hours: number | string
  note: string | null
  sort_at: string
  adjustment_id: string | null
}

type EventOptionRow = {
  id: string
  title: string
  starts_at: string
}

type AdjustmentRow = {
  id: string
  person_id: string
  event_id: string | null
  hours_delta: number | string
  credited_on: string
  note: string | null
  created_at: string
}

type PersonSummary = {
  personId: string
  displayName: string
  email: string | null
  currentEventCount: number
  currentEventHours: number
  currentManualHours: number
  currentTotalHours: number
  allTimeEventCount: number
  allTimeTotalHours: number
  lastVolunteeredOn: string | null
  lastCreditOn: string | null
  recentEntries: ContributionEntryRow[]
  activeAdjustments: AdjustmentRow[]
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

function formatSignedHours(value: number) {
  if (value > 0) return `+${formatHours(value)}`
  if (value < 0) return `-${formatHours(Math.abs(value))}`
  return formatHours(value)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function getDefaultReportingYearSettings(orgTypeCode?: string | null): ReportingYearSettingsRow {
  if (orgTypeCode === 'knights_of_columbus') {
    return {
      year_label: 'Fraternal year',
      year_start_month: 7,
      year_start_day: 1,
    }
  }

  return {
    year_label: 'Calendar year',
    year_start_month: 1,
    year_start_day: 1,
  }
}

function buildReportingYearRange(settings: ReportingYearSettingsRow, today = new Date()) {
  const currentYear = today.getFullYear()
  const startThisYear = new Date(Date.UTC(currentYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const startYear = today.getTime() >= startThisYear.getTime() ? currentYear : currentYear - 1
  const start = new Date(Date.UTC(startYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const end = new Date(Date.UTC(startYear + 1, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  return {
    startDate,
    endDate,
    label: `${settings.year_label} ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}

function personDisplayName(person: PersonRow) {
  const preferred = person.preferred_display_name?.trim()
  if (!preferred) return `${person.first_name} ${person.last_name}`.trim()

  const normalizedPreferred = preferred.toLowerCase()
  const normalizedLastName = person.last_name.trim().toLowerCase()
  if (normalizedLastName && normalizedPreferred.endsWith(normalizedLastName)) return preferred

  return `${preferred} ${person.last_name}`.trim()
}

function isWithinRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date < endDate
}

export default async function VolunteerHoursPage() {
  const { admin: supabase, council, permissions, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/events/volunteer-hours',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  if (!localUnitId) notFound()

  const [organizationResult, settingsResult, directoryPeopleResult, entriesResult, eventsResult, adjustmentsResult] = await Promise.all([
    council.organization_id
      ? supabase
          .from('organizations')
          .select('display_name, preferred_name, org_type_code, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle<OrganizationRow>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('local_unit_reporting_year_settings')
      .select('year_label, year_start_month, year_start_day')
      .eq('local_unit_id', localUnitId)
      .maybeSingle<ReportingYearSettingsRow>(),
    listValidDirectoryPeopleForLocalUnit({ admin: supabase, localUnitId })
      .then((data) => ({ data: data as PersonRow[], error: null }))
      .catch((error: Error) => ({ data: [] as PersonRow[], error })),
    supabase
      .from('local_unit_volunteer_contribution_entries')
      .select('source_type, source_id, local_unit_id, person_id, event_id, event_title, credited_on, hours, note, sort_at, adjustment_id')
      .eq('local_unit_id', localUnitId)
      .order('credited_on', { ascending: false })
      .returns<ContributionEntryRow[]>(),
    supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('local_unit_id', localUnitId)
      .eq('status_code', 'completed')
      .eq('event_kind_code', 'standard')
      .order('starts_at', { ascending: false })
      .limit(100)
      .returns<EventOptionRow[]>(),
    supabase
      .from('local_unit_volunteer_hour_adjustments')
      .select('id, person_id, event_id, hours_delta, credited_on, note, created_at')
      .eq('local_unit_id', localUnitId)
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .returns<AdjustmentRow[]>(),
  ])

  if (
    organizationResult.error ||
    settingsResult.error ||
    directoryPeopleResult.error ||
    entriesResult.error ||
    eventsResult.error ||
    adjustmentsResult.error
  ) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader permissions={permissions} />
          <section className="qv-card qv-error">Could not load volunteer hour data.</section>
        </div>
      </main>
    )
  }

  const organization = organizationResult.data ?? null
  const defaultSettings = getDefaultReportingYearSettings(organization?.org_type_code)
  const reportingYearSettings = settingsResult.data ?? defaultSettings
  const reportingYear = buildReportingYearRange(reportingYearSettings)
  const entries = entriesResult.data ?? []
  const activeAdjustments = adjustmentsResult.data ?? []
  const entriesByPersonId = new Map<string, ContributionEntryRow[]>()
  const adjustmentsByPersonId = new Map<string, AdjustmentRow[]>()

  for (const entry of entries) {
    entriesByPersonId.set(entry.person_id, [...(entriesByPersonId.get(entry.person_id) ?? []), entry])
  }

  for (const adjustment of activeAdjustments) {
    adjustmentsByPersonId.set(adjustment.person_id, [...(adjustmentsByPersonId.get(adjustment.person_id) ?? []), adjustment])
  }

  const people = directoryPeopleResult.data ?? []
  const summaries: PersonSummary[] = people.map((person) => {
    const personEntries = entriesByPersonId.get(person.id) ?? []
    const currentEntries = personEntries.filter((entry) => isWithinRange(entry.credited_on, reportingYear.startDate, reportingYear.endDate))
    const eventEntries = currentEntries.filter((entry) => entry.source_type === 'event')
    const manualEntries = currentEntries.filter((entry) => entry.source_type === 'manual_adjustment')
    const allEventEntries = personEntries.filter((entry) => entry.source_type === 'event')

    return {
      personId: person.id,
      displayName: personDisplayName(person),
      email: person.email?.trim() ?? null,
      currentEventCount: new Set(eventEntries.map((entry) => entry.event_id).filter(Boolean)).size,
      currentEventHours: eventEntries.reduce((total, entry) => total + toNumber(entry.hours), 0),
      currentManualHours: manualEntries.reduce((total, entry) => total + toNumber(entry.hours), 0),
      currentTotalHours: currentEntries.reduce((total, entry) => total + toNumber(entry.hours), 0),
      allTimeEventCount: new Set(allEventEntries.map((entry) => entry.event_id).filter(Boolean)).size,
      allTimeTotalHours: personEntries.reduce((total, entry) => total + toNumber(entry.hours), 0),
      lastVolunteeredOn: eventEntries[0]?.credited_on ?? allEventEntries[0]?.credited_on ?? null,
      lastCreditOn: currentEntries[0]?.credited_on ?? personEntries[0]?.credited_on ?? null,
      recentEntries: personEntries.slice(0, 5),
      activeAdjustments: adjustmentsByPersonId.get(person.id) ?? [],
    }
  }).sort((left, right) => {
    const totalDiff = right.currentTotalHours - left.currentTotalHours
    if (totalDiff !== 0) return totalDiff
    return left.displayName.localeCompare(right.displayName)
  })

  const totalPeople = summaries.length
  const peopleWithHours = summaries.filter((summary) => summary.currentTotalHours !== 0).length
  const totalCurrentHours = summaries.reduce((total, summary) => total + summary.currentTotalHours, 0)
  const totalCurrentEvents = summaries.reduce((total, summary) => summary.currentEventCount + total, 0)
  const completedEvents = eventsResult.data ?? []
  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Local organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const currentCouncilLabel = `${organizationName}${council.council_number ? ` (${council.council_number})` : ''}`

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader permissions={permissions} />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">{currentCouncilLabel}</p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Volunteer hours</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10, maxWidth: 680 }}>
                Audit completed-event volunteer hours and manual adjustments for people in this local organization.
              </p>
              <div style={{ display: 'grid', gap: 6, marginTop: 22 }}>
                <p className="qv-detail-label" style={{ margin: 0 }}>{reportingYear.label}</p>
                <p className="qv-section-subtitle" style={{ margin: 0 }}>
                  {formatDate(reportingYear.startDate)} through {formatDate(reportingYear.endDate)} · Completed events only
                </p>
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

          <div className="qv-stats">
            <div className="qv-stat-card"><div className="qv-stat-number">{formatHours(totalCurrentHours)}</div><div className="qv-stat-label">Total hours</div></div>
            <div className="qv-stat-card"><div className="qv-stat-number">{totalCurrentEvents}</div><div className="qv-stat-label">Volunteer event credits</div></div>
            <div className="qv-stat-card"><div className="qv-stat-number">{peopleWithHours}</div><div className="qv-stat-label">People with hours</div></div>
            <div className="qv-stat-card"><div className="qv-stat-number">{totalPeople}</div><div className="qv-stat-label">People audited</div></div>
          </div>
        </section>

        <SectionMenuBar items={[{ label: 'Back to events', href: '/events' }]} />

        <div className="qv-detail-grid">
          <section className="qv-card qv-volunteer-hours-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Contribution audit</h2>
                <p className="qv-section-subtitle">Sorted by total hours in the current reporting year.</p>
              </div>
            </div>

            {summaries.length === 0 ? (
              <div className="qv-empty"><h3 className="qv-empty-title">No people found</h3><p className="qv-empty-text">Add people to this local organization before tracking volunteer hours.</p></div>
            ) : (
              <div className="qv-member-list qv-volunteer-hours-list">
                {summaries.map((summary) => (
                  <article key={summary.personId} className="qv-member-row qv-volunteer-hours-row">
                    <div className="qv-member-main">
                      <div className="qv-member-text">
                        <div className="qv-member-name">
                          <Link href={`/people/${summary.personId}`} className="qv-inline-link">{summary.displayName}</Link>
                        </div>
                        <div className="qv-member-meta">{summary.email || 'No email on file'}</div>
                        <div className="qv-volunteer-hours-pills">
                          <span className="qv-mini-pill">Total: {formatHours(summary.currentTotalHours)}h</span>
                          <span className="qv-mini-pill">Events participation: {summary.currentEventCount}</span>
                          <span className="qv-mini-pill">Events hours: {formatHours(summary.currentEventHours)}h</span>
                          <span className="qv-mini-pill">Adjustments: {formatSignedHours(summary.currentManualHours)}h</span>
                          <span className="qv-mini-pill">Last credit: {formatDate(summary.lastCreditOn)}</span>
                        </div>

                        {summary.recentEntries.length > 0 ? (
                          <details style={{ marginTop: 12 }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Recent entries</summary>
                            <div className="qv-detail-list" style={{ marginTop: 10 }}>
                              {summary.recentEntries.map((entry) => (
                                <div key={entry.source_id} className="qv-detail-item">
                                  <div className="qv-detail-label">{entry.source_type === 'event' ? 'Completed event' : 'Manual adjustment'} · {formatDate(entry.credited_on)}</div>
                                  <div className="qv-detail-value">{entry.event_title ?? 'Manual adjustment'} · {formatHours(toNumber(entry.hours))}h</div>
                                  {entry.note ? <div className="qv-member-meta">{entry.note}</div> : null}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        {summary.activeAdjustments.length > 0 ? (
                          <details style={{ marginTop: 12 }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Active manual adjustments</summary>
                            <div className="qv-detail-list" style={{ marginTop: 10 }}>
                              {summary.activeAdjustments.map((adjustment) => (
                                <div key={adjustment.id} className="qv-detail-item">
                                  <div className="qv-detail-label">{formatDate(adjustment.credited_on)}</div>
                                  <div className="qv-detail-value">{formatHours(toNumber(adjustment.hours_delta))}h</div>
                                  {adjustment.note ? <div className="qv-member-meta">{adjustment.note}</div> : null}
                                  <form action={voidVolunteerHourAdjustment} className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                                    <input type="hidden" name="adjustment_id" value={adjustment.id} />
                                    <input type="hidden" name="person_id" value={summary.personId} />
                                    <input type="hidden" name="void_reason" value="Voided from volunteer hours audit page." />
                                    <button type="submit" className="qv-button-secondary">Void adjustment</button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="qv-detail-stack">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Add adjustment</h2>
                  <p className="qv-section-subtitle">Use positive or negative hours. Event participation itself remains calculated.</p>
                </div>
              </div>

              <form action={addVolunteerHourAdjustment} className="qv-form-grid">
                <label className="qv-control">
                  <span className="qv-label">Person</span>
                  <select name="person_id" required>
                    <option value="">Choose a person</option>
                    {summaries.map((summary) => <option key={summary.personId} value={summary.personId}>{summary.displayName}</option>)}
                  </select>
                </label>

                <label className="qv-control">
                  <span className="qv-label">Related completed event</span>
                  <select name="event_id">
                    <option value="">No event / general adjustment</option>
                    {completedEvents.map((event) => <option key={event.id} value={event.id}>{event.title} · {formatDate(event.starts_at.slice(0, 10))}</option>)}
                  </select>
                </label>

                <label className="qv-control">
                  <span className="qv-label">Hours adjustment</span>
                  <input type="number" name="hours_delta" step="0.25" min="-999" max="999" required placeholder="2.5 or -1" />
                </label>

                <label className="qv-control">
                  <span className="qv-label">Credited date</span>
                  <input type="date" name="credited_on" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </label>

                <label className="qv-control">
                  <span className="qv-label">Note</span>
                  <textarea name="note" placeholder="Reason for the adjustment" />
                </label>

                <div className="qv-form-actions">
                  <button type="submit" className="qv-button-primary">Save adjustment</button>
                </div>
              </form>
            </section>

            <section className="qv-card">
              <h2 className="qv-section-title">Rules</h2>
              <div className="qv-detail-list">
                <div className="qv-detail-item"><div className="qv-detail-label">Event hours</div><div className="qv-detail-value">Completed standard events only. End time sets duration; missing end time counts as 1 hour.</div></div>
                <div className="qv-detail-item"><div className="qv-detail-label">People scope</div><div className="qv-detail-value">Only person-linked volunteer attendees in this local organization count.</div></div>
                <div className="qv-detail-item"><div className="qv-detail-label">Recognition</div><div className="qv-detail-value">Gold/Silver/Bronze volunteer levels are intentionally deferred until reporting totals are stable.</div></div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
