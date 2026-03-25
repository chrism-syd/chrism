import Link from 'next/link'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'

type EventRow = {
  id: string
  title: string
  location_name: string | null
  starts_at: string
  ends_at: string
  status_code: string
  scope_code: 'home_council_only' | 'multi_council'
  requires_rsvp: boolean
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
}

type EventSummaryRow = {
  event_id: string
  invited_council_count: number
  responded_council_count: number
  total_volunteer_count: number
}

type EventPersonSummaryRow = {
  event_id: string
  active_submission_count: number
  total_volunteer_count: number
  last_responded_at: string | null
}

function formatDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (sameDay) return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} to ${timeFormatter.format(end)}`
  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} to ${dateFormatter.format(end)} ${timeFormatter.format(end)}`
}

function getScopeLabel(scopeCode: EventRow['scope_code']) {
  return scopeCode === 'multi_council' ? 'Multi-council' : 'Home council only'
}

function getStatusLabel(statusCode: string) {
  if (statusCode === 'draft') return 'Draft'
  if (statusCode === 'completed') return 'Completed'
  if (statusCode === 'cancelled') return 'Cancelled'
  return 'Scheduled'
}

function getStatusPillClass(statusCode: string) {
  return statusCode === 'draft' ? 'qv-mini-pill qv-mini-pill-draft' : 'qv-mini-pill'
}

function getMeetingLabel(kind: EventRow['event_kind_code']) {
  if (kind === 'executive_meeting') return 'Executive meeting'
  if (kind === 'general_meeting') return 'General meeting'
  return 'Meeting'
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="qv-empty">
      <h3 className="qv-empty-title">{title}</h3>
      <p className="qv-empty-text">{body}</p>
    </div>
  )
}

export default async function EventsPage() {
  const { admin: supabase, council } = await getCurrentActingCouncilContext({ redirectTo: '/me' })

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
  const publicMeetingsHref = council.council_number ? `/councils/${council.council_number}/meetings` : null
  const meetingsFeedHref = council.council_number ? `/councils/${council.council_number}/meetings.ics` : null

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('id, title, location_name, starts_at, ends_at, status_code, scope_code, requires_rsvp, event_kind_code')
    .eq('council_id', council.id)
    .order('starts_at', { ascending: true })
    .returns<EventRow[]>()

  if (eventsError) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <section className="qv-card qv-error">Could not load events.</section>
        </div>
      </main>
    )
  }

  const events = eventsData ?? []
  const standardEvents = events.filter((event) => event.event_kind_code === 'standard')
  const nowIso = new Date().toISOString()
  const meetingEvents = events.filter(
    (event) =>
      event.event_kind_code !== 'standard' &&
      !['draft', 'completed', 'cancelled'].includes(event.status_code) &&
      event.ends_at >= nowIso
  )
  const draftEvents = standardEvents.filter((event) => event.status_code === 'draft')
  const hostedEvents = standardEvents.filter(
    (event) => !['draft', 'completed', 'cancelled'].includes(event.status_code)
  )

  const standardIds = standardEvents.map((event) => event.id)
  const multiIds = standardEvents.filter((event) => event.scope_code === 'multi_council').map((event) => event.id)
  const singleIds = standardEvents.filter((event) => event.scope_code === 'home_council_only').map((event) => event.id)

  let councilSummaries: EventSummaryRow[] = []
  let personSummaries: EventPersonSummaryRow[] = []
  let externalInviteeCountMap = new Map<string, number>()

  if (multiIds.length) {
    const { data } = await supabase
      .from('event_host_summary')
      .select('event_id, invited_council_count, responded_council_count, total_volunteer_count')
      .in('event_id', multiIds)
      .returns<EventSummaryRow[]>()
    councilSummaries = data ?? []
  }

  if (singleIds.length) {
    const { data } = await supabase
      .from('event_person_rsvp_summary')
      .select('event_id, active_submission_count, total_volunteer_count, last_responded_at')
      .in('event_id', singleIds)
      .returns<EventPersonSummaryRow[]>()
    personSummaries = data ?? []
  }

  if (standardIds.length) {
    const { data } = await supabase.from('event_external_invitees').select('event_id').in('event_id', standardIds)
    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      const eventId = (row as { event_id: string }).event_id
      counts.set(eventId, (counts.get(eventId) ?? 0) + 1)
    }
    externalInviteeCountMap = counts
  }

  const councilSummaryMap = new Map(councilSummaries.map((summary) => [summary.event_id, summary]))
  const personSummaryMap = new Map(personSummaries.map((summary) => [summary.event_id, summary]))

  function renderStandardEventList(eventRows: EventRow[]) {
    if (!eventRows.length) return null

    return (
      <div className="qv-member-list">
        {eventRows.map((event) => {
          const isSingle = event.scope_code === 'home_council_only'
          const councilSummary = councilSummaryMap.get(event.id)
          const personSummary = personSummaryMap.get(event.id)
          const respondedCount = isSingle
            ? personSummary?.active_submission_count ?? 0
            : councilSummary?.responded_council_count ?? 0
          const volunteerCount = isSingle
            ? personSummary?.total_volunteer_count ?? 0
            : councilSummary?.total_volunteer_count ?? 0
          const invitedCount = isSingle ? null : councilSummary?.invited_council_count ?? 0
          const externalInviteeCount = externalInviteeCountMap.get(event.id) ?? 0

          return (
            <Link key={event.id} href={`/events/${event.id}`} className="qv-member-link">
              <article className="qv-member-row">
                <div className="qv-member-main">
                  <div className="qv-member-text">
                    <div className="qv-member-name">{event.title}</div>
                    <div className="qv-member-meta">{formatDateRange(event.starts_at, event.ends_at)}</div>
                    {event.location_name ? <div className="qv-member-meta">{event.location_name}</div> : null}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      <span className={getStatusPillClass(event.status_code)}>{getStatusLabel(event.status_code)}</span>
                      <span className="qv-mini-pill">{getScopeLabel(event.scope_code)}</span>
                      <span className="qv-mini-pill">{event.requires_rsvp ? 'RSVP required' : 'No RSVP'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                      {!isSingle ? <span className="qv-member-meta">Invited: {invitedCount ?? 0}</span> : null}
                      <span className="qv-member-meta">RSVPs: {respondedCount}</span>
                      <span className="qv-member-meta">Volunteers: {volunteerCount}</span>
                      <span className="qv-member-meta">External invitees: {externalInviteeCount}</span>
                    </div>
                  </div>
                </div>

                <div className="qv-member-row-right">
                  <span className="qv-chevron">›</span>
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    )
  }

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
                <h1 className="qv-directory-name">Events</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Manage events, meetings, RSVPs, and volunteer responses.
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

        <SectionMenuBar
          items={[
            { label: 'Add event', href: '/events/new' },
            { label: 'Archived events', href: '/events/archive' },
          ]}
        />

        <div className="qv-detail-grid">
          <div className="qv-detail-stack">
            {hostedEvents.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Hosted events</h2>
                    <p className="qv-section-subtitle">{hostedEvents.length} active</p>
                  </div>
                </div>
                {renderStandardEventList(hostedEvents)}
              </section>
            ) : null}

            {draftEvents.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Drafts</h2>
                    <p className="qv-section-subtitle">{draftEvents.length} saved</p>
                  </div>
                </div>
                {renderStandardEventList(draftEvents)}
              </section>
            ) : null}

            {hostedEvents.length === 0 && draftEvents.length === 0 ? (
              <section className="qv-card">
                <EmptyState
                  title="No events yet"
                  body="Create your first event to start tracking participation and RSVP responses."
                />
              </section>
            ) : null}
          </div>

          <div className="qv-detail-stack">
            {meetingEvents.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <h2 className="qv-section-title">Meetings</h2>
                    <p className="qv-section-subtitle">Upcoming council meetings only. Completed meetings move to the archive.</p>
                  </div>

                  {publicMeetingsHref || meetingsFeedHref ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {publicMeetingsHref ? (
                        <Link href={publicMeetingsHref} className="qv-link-button qv-button-secondary">
                          Public meetings page
                        </Link>
                      ) : null}
                      {meetingsFeedHref ? (
                        <Link href={meetingsFeedHref} className="qv-link-button qv-button-secondary">
                          ICS feed
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="qv-detail-list">
                  {meetingEvents.map((event) => (
                    <div key={event.id} className="qv-detail-item">
                      <div className="qv-detail-label">{formatDateRange(event.starts_at, event.ends_at)}</div>
                      <div className="qv-detail-value">
                        <Link href={`/events/${event.id}`} className="qv-inline-link">
                          {event.title}
                        </Link>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className="qv-mini-pill">{getMeetingLabel(event.event_kind_code)}</span>
                        <span className={getStatusPillClass(event.status_code)}>{getStatusLabel(event.status_code)}</span>
                      </div>
                      {event.location_name ? (
                        <div style={{ marginTop: 4, fontSize: 14, color: 'var(--text-secondary)' }}>
                          {event.location_name}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
